import * as auditLogService from "./auditLog.service.js";

/**
 * Controller: GET /api/v1/audit-logs
 * Retrieves paginated audit logs with search & filters.
 */
export const getAuditLogs = async (req, res, next) => {
  try {
    const result = await auditLogService.getAuditLogsService(req.query, req.user);
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Audit logs retrieved successfully",
      data: result.logs,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/v1/audit-logs/:id
 * Retrieves detailed snapshot of a single audit log entry.
 */
export const getAuditLogById = async (req, res, next) => {
  try {
    const log = await auditLogService.getAuditLogByIdService(req.params.id, req.user);
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Audit log entry retrieved successfully",
      data: log,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: GET /api/v1/audit-logs/export
 * Downloads full audit logs dataset (Super Admin only).
 */
export const exportAuditLogs = async (req, res, next) => {
  try {
    const format = (req.query.format || "csv").toLowerCase();
    const exportFile = await auditLogService.exportAuditLogsService(req.query, req.user, format);

    res.setHeader("Content-Type", exportFile.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${exportFile.filename}"`);
    return res.status(200).send(exportFile.data);
  } catch (error) {
    next(error);
  }
};
