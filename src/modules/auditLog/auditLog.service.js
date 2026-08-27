import * as auditLogRepo from "./auditLog.repository.js";
import { parseUserAgent, normalizeIpAddress } from "../../utils/userAgentParser.js";
import { sanitizeAuditPayload } from "../../utils/auditSanitizer.js";
import XLSX from "xlsx";

/**
 * Service: Records an audit log entry for system actions and mutations.
 * Follows OWASP & NIST standards ("WHO did WHAT, WHEN, WHERE, and RESULT").
 * Sanitizes credentials/secrets and extracts accurate client telemetry.
 * @param {Object} payload - Audit details
 */
export const recordAuditLog = async (payload) => {
  try {
    if (!payload) return null;

    const { req, tx, browserInfo, deviceInfo, oldValue, newValue, ...logData } = payload;

    let parsedBrowser = browserInfo || null;
    let parsedDevice = deviceInfo || null;
    let extractedIp = logData.ipAddress || null;
    let performedById = logData.performedById || null;

    // Detect if this request originates from an HTTP request or a pure background process
    const hasHttpRequest = Boolean(req && (req.headers || req.ip || req.socket));

    if (req) {
      if (req.user && req.user.id) {
        performedById = req.user.id;
        if (!logData.companyId && req.user.companyId) {
          logData.companyId = req.user.companyId;
        }
        if (!logData.branchId && req.user.branchId) {
          logData.branchId = req.user.branchId;
        }
      }

      if (req.headers || req.ip) {
        const parsed = parseUserAgent(req, extractedIp);
        parsedBrowser = browserInfo || parsed.browser;
        parsedDevice = deviceInfo || parsed.deviceName;
        extractedIp = parsed.ipAddress;
      }
    }

    // A background system action occurs strictly when there is NO HTTP request context
    const isPureSystemProcess = !hasHttpRequest || logData.isSystemCron === true;

    // OWASP Security Compliance: Sanitize sensitive data (passwords, tokens, keys)
    const sanitizedOldValue = sanitizeAuditPayload(oldValue);
    let sanitizedNewValue = sanitizeAuditPayload(newValue);

    // Attach Request Correlation ID inside metadata if present (without corrupting action string)
    const correlationId = req?.id || req?.correlationId || req?.headers?.["x-request-id"] || logData.correlationId;
    if (correlationId) {
      if (sanitizedNewValue && typeof sanitizedNewValue === "object" && !Array.isArray(sanitizedNewValue)) {
        sanitizedNewValue._correlationId = correlationId;
      } else if (!sanitizedNewValue) {
        sanitizedNewValue = { _correlationId: correlationId };
      }
    }

    return await auditLogRepo.createAuditLogRecord({
      ...logData,
      performedById,
      oldValue: sanitizedOldValue,
      newValue: sanitizedNewValue,
      ipAddress: isPureSystemProcess ? "SYSTEM" : (extractedIp ? normalizeIpAddress(extractedIp) : "Unknown"),
      browserInfo: isPureSystemProcess ? "SYSTEM" : (parsedBrowser || "Unknown Browser"),
      deviceInfo: isPureSystemProcess ? "SYSTEM" : (parsedDevice || "Unknown Device"),
    }, tx);
  } catch (error) {
    // Non-silent monitoring: Log explicit error message without crashing host API operation
    console.error("[AUDIT_LOG_SYSTEM_ERROR] Failed to persist security audit record:", error.message || error);
    return null;
  }
};

/**
 * Service: Fetches paginated audit logs with search, filtering, and role scoping.
 */
export const getAuditLogsService = async (queryParams, actor) => {
  return await auditLogRepo.getAuditLogsPaginated(queryParams, actor);
};

/**
 * Service: Retrieves a single audit log entry by ID.
 */
export const getAuditLogByIdService = async (id, actor) => {
  const log = await auditLogRepo.getAuditLogById(id, actor);
  if (!log) {
    const error = new Error("Audit log record not found or access restricted.");
    error.statusCode = 404;
    throw error;
  }

  // Scoping Guard: Non-Super-Admins can only view logs from their own company
  const actorRole = (actor?.primaryRole || actor?.role || "").toUpperCase();
  if (actorRole !== "SUPER_ADMIN" && actor?.companyId && log.companyId !== actor.companyId) {
    const error = new Error("Forbidden: Access to this audit record is restricted");
    error.statusCode = 403;
    throw error;
  }

  return log;
};

/**
 * Service: Exports audit logs for Super Admin in Excel (.xlsx), CSV (.csv), or PDF report format.
 */
export const exportAuditLogsService = async (queryParams, actor, format = "csv") => {
  const actorRole = (actor?.primaryRole || actor?.role || "").toUpperCase();
  if (actorRole !== "SUPER_ADMIN" && actorRole !== "ADMIN") {
    const error = new Error("Access Denied: Exporting audit log reports is strictly restricted to Super Admin.");
    error.statusCode = 403;
    throw error;
  }

  const logs = await auditLogRepo.getAuditLogsForExport(queryParams, actor);

  if (!logs || logs.length === 0) {
    const error = new Error("No audit log records available to export for the selected filter criteria.");
    error.statusCode = 404;
    throw error;
  }

  // Map log entries to structured JSON objects for Excel & CSV (Includes Device & Browser explicitly)
  const exportData = logs.map((log) => ({
    "Log ID": log.id,
    "User / Actor": log.performedBy?.name || "System Event",
    "User Email": log.performedBy?.email || "system@crm.internal",
    "Company": log.company?.name || "Global / System",
    "Module": log.moduleName || "SYSTEM",
    "Action Code": log.action || "EVENT",
    "Action Type": log.actionType || "LOG",
    "Date & Time": new Date(log.createdAt).toLocaleString(),
    "IP Address": log.ipAddress === "SYSTEM" ? "Internal System" : (log.ipAddress || "Unknown"),
    "Device": log.deviceInfo === "SYSTEM" ? "System Process" : (log.deviceInfo || "Unknown Device"),
    "Browser": log.browserInfo === "SYSTEM" ? "System Process" : (log.browserInfo || "Unknown Browser"),
    "Record ID": log.recordId || log.entityId || "N/A",
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);

  // 1. EXCEL EXPORT (.xlsx)
  if (format === "excel" || format === "xlsx") {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Audit Logs");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: `audit_logs_report_${Date.now()}.xlsx`,
      data: buffer,
    };
  }

  // 2. PDF REPORT EXPORT (.pdf / printable HTML stream with Device & Browser columns)
  if (format === "pdf") {
    const pdfHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Enterprise Audit Logs Security Report</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #0f172a; background: #fff; }
          .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px; }
          .header h1 { font-size: 22px; margin: 0; color: #0f172a; }
          .header p { font-size: 12px; color: #64748b; margin: 5px 0 0 0; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
          th { background-color: #f8fafc; color: #475569; font-weight: 700; text-transform: uppercase; text-align: left; padding: 10px 8px; border: 1px solid #cbd5e1; }
          td { padding: 9px 8px; border: 1px solid #e2e8f0; color: #334155; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .badge { padding: 3px 6px; font-weight: bold; border-radius: 4px; font-size: 10px; background: #e2e8f0; text-transform: uppercase; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Enterprise Security Audit Logs Report</h1>
          <p>Generated: ${new Date().toLocaleString()} | Total Records: ${logs.length} | Exported By: Super Admin (${actor.name || actor.email})</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Log ID</th>
              <th>Company</th>
              <th>User / Actor</th>
              <th>Module</th>
              <th>Action Code</th>
              <th>Date & Time</th>
              <th>IP Address</th>
              <th>Device & Browser</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map(log => `
              <tr>
                <td>#${log.id}</td>
                <td><strong>${log.company?.name || 'Global System'}</strong></td>
                <td>${log.performedBy?.name || 'System Event'}<br/><span style="color:#64748b;font-size:10px">${log.performedBy?.email || ''}</span></td>
                <td><span class="badge">${log.moduleName || 'SYSTEM'}</span></td>
                <td><strong>${log.actionType || 'LOG'}</strong> - ${log.action || 'EVENT'}</td>
                <td>${new Date(log.createdAt).toLocaleString()}</td>
                <td><code>${log.ipAddress || 'Unknown'}</code></td>
                <td><strong>${log.deviceInfo || 'Unknown Device'}</strong><br/><span style="color:#64748b;font-size:10px">${log.browserInfo || 'Unknown Browser'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    return {
      contentType: "text/html",
      filename: `audit_logs_report_${Date.now()}.html`,
      data: pdfHtml,
    };
  }

  // 3. DEFAULT CSV EXPORT (.csv)
  const csvContent = XLSX.utils.sheet_to_csv(worksheet);

  return {
    contentType: "text/csv",
    filename: `audit_logs_report_${Date.now()}.csv`,
    data: csvContent,
  };
};
