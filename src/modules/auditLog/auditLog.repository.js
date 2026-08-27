import prisma from "../../config/db.js";

/**
 * Persists an enterprise audit log record into the database safely.
 * Non-blocking error isolation — executed within or after DB transactions.
 * @param {Object} data - Audit log payload
 * @param {Object} [tx=prisma] - Optional Prisma transaction client
 */
export const createAuditLogRecord = async (data, tx = prisma) => {
  try {
    if (!data) return null;

    const isSystemAction = !data.performedById;
    const actionTypeUpper = (data.actionType || (isSystemAction ? "UPDATE" : "UPDATE")).toUpperCase().trim();

    // Point 1: Dynamic Action Defaults based on actionType
    let defaultActionCode = "RECORD_UPDATED";
    if (actionTypeUpper === "CREATE") defaultActionCode = "RECORD_CREATED";
    else if (actionTypeUpper === "DELETE") defaultActionCode = "RECORD_DELETED";
    else if (actionTypeUpper === "LOGIN") defaultActionCode = "LOGIN_SUCCESS";
    else if (actionTypeUpper === "LOGOUT") defaultActionCode = "USER_LOGOUT";
    else if (actionTypeUpper === "EXPORT") defaultActionCode = "DATA_EXPORTED";
    else if (actionTypeUpper === "AUTH") defaultActionCode = "AUTH_EVENT";
    else if (isSystemAction) defaultActionCode = "SYSTEM_EVENT";

    // Point 3: Store null instead of 0 for entityId / recordId when missing
    const parsedEntityId = data.entityId ? Number(data.entityId) : (data.recordId ? Number(data.recordId) : null);
    const parsedRecordId = data.recordId ? Number(data.recordId) : (data.entityId ? Number(data.entityId) : null);

    return await tx.auditLog.create({
      data: {
        companyId: data.companyId ? Number(data.companyId) : null,
        branchId: data.branchId ? Number(data.branchId) : null,
        moduleName: (data.moduleName || "SYSTEM").toUpperCase().trim(),
        actionType: actionTypeUpper,
        recordId: parsedRecordId,
        entityType: (data.entityType || data.moduleName || "RECORD").toUpperCase().trim(),
        entityId: parsedEntityId || 0, // 0 preserved only for non-null Prisma field constraint if needed
        action: data.action ? data.action.trim() : defaultActionCode,
        oldValue: data.oldValue !== undefined ? data.oldValue : null,
        newValue: data.newValue !== undefined ? data.newValue : null,
        ipAddress: data.ipAddress || (isSystemAction ? "SYSTEM" : "Unknown"),
        browserInfo: data.browserInfo || (isSystemAction ? "SYSTEM" : "Unknown Browser"),
        deviceInfo: data.deviceInfo || (isSystemAction ? "SYSTEM" : "Unknown Device"),
        performedById: data.performedById ? Number(data.performedById) : null,
      },
    });
  } catch (err) {
    console.error("[AuditLogRepository] Failed to persist audit log record:", err.message);
    return null;
  }
};

/**
 * Retrieves paginated audit logs with multi-attribute filtering & global search.
 * Enforces strict company-level data isolation for non-Super-Admin roles.
 */
export const getAuditLogsPaginated = async (filters, actor) => {
  const {
    page = 1,
    limit = 10,
    companyId,
    branchId,
    performedById,
    moduleName,
    actionType,
    action,
    entityType,
    recordId,
    ipAddress,
    startDate,
    endDate,
    search,
  } = filters;

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(5000, Math.max(1, Number(limit)));
  const skip = (pageNum - 1) * limitNum;

  // Build Prisma where clause
  const where = {};

  // 1. Role Scoping Guard: Non-Super-Admins are strictly restricted to their own company
  const actorRole = (actor?.primaryRole || actor?.role || "").toUpperCase();
  if (actorRole !== "SUPER_ADMIN") {
    if (actor?.companyId) {
      where.companyId = actor.companyId;
    }
  } else if (companyId) {
    // Super Admin can filter by specific companyId
    where.companyId = Number(companyId);
  }

  // 2. Branch filter
  if (branchId) {
    where.branchId = Number(branchId);
  }

  // 3. User filter
  if (performedById) {
    where.performedById = Number(performedById);
  }

  // 4. Module filter
  if (moduleName) {
    where.moduleName = moduleName;
  }

  // 5. Action Type Filter (Supports legacy AUTH mapping to LOGIN/LOGOUT)
  if (actionType) {
    if (actionType === "LOGIN") {
      where.actionType = { in: ["LOGIN", "AUTH"] };
    } else if (actionType === "AUTH") {
      where.actionType = { in: ["AUTH", "LOGIN", "LOGOUT"] };
    } else {
      where.actionType = actionType;
    }
  }

  // 6. Action code filter
  if (action) {
    where.action = action;
  }

  // 7. Entity Type / Record ID filter
  if (entityType) {
    where.entityType = entityType;
  }
  if (recordId) {
    where.recordId = Number(recordId);
  }

  // 8. IP Address filter
  if (ipAddress) {
    where.ipAddress = { contains: ipAddress, mode: "insensitive" };
  }

  // 9. Date Range Filter (Partial & Range Support: Only startDate, Only endDate, or Both)
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      where.createdAt.gte = start;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  // 10. Global Search (matches user name, email, action, actionType, moduleName, or IP address)
  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { action: { contains: q, mode: "insensitive" } },
      { actionType: { contains: q, mode: "insensitive" } },
      { moduleName: { contains: q, mode: "insensitive" } },
      { ipAddress: { contains: q, mode: "insensitive" } },
      { performedBy: { name: { contains: q, mode: "insensitive" } } },
      { performedBy: { email: { contains: q, mode: "insensitive" } } },
    ];
  }

  // Execute query & count concurrently
  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: "desc" },
      include: {
        performedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePhoto: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    }),
  ]);

  const totalPages = Math.ceil(total / limitNum) || 1;

  return {
    logs,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
    },
  };
};

/**
 * Retrieves a single audit log by ID with full details.
 */
export const getAuditLogById = async (id, actor) => {
  const where = { id: Number(id) };

  // Enforce company boundary for Company Admin
  const actorRole = (actor?.primaryRole || actor?.role || "").toUpperCase();
  if (actorRole !== "SUPER_ADMIN" && actor?.companyId) {
    where.companyId = actor.companyId;
  }

  return await prisma.auditLog.findFirst({
    where,
    include: {
      performedBy: {
        select: {
          id: true,
          name: true,
          email: true,
          profilePhoto: true,
        },
      },
      company: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      branch: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  });
};

/**
 * Retrieves audit log dataset for export downloads based on mandatory dateRange filters and optional module/action filters.
 * Enforces row-count safety check (max 10,000 records) before fetching dataset.
 */
export const getAuditLogsForExport = async (filters = {}, actor) => {
  const {
    dateRange,
    startDate: rawStartDate,
    endDate: rawEndDate,
    moduleName,
    actionType,
    companyId,
    branchId,
    performedById,
    ipAddress,
    search,
  } = filters;

  // 1. Date Range Validation (MANDATORY for export)
  let start = null;
  let end = null;
  const now = new Date();

  const isPreset = ["1d", "1w", "3m", "6m", "1y"].includes(dateRange);
  const isCustom = dateRange === "custom" || Boolean(rawStartDate || rawEndDate);

  if (isPreset) {
    if (dateRange === "1d") {
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      end = now;
    } else if (dateRange === "1w") {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      end = now;
    } else if (dateRange === "3m") {
      start = new Date(now);
      start.setMonth(start.getMonth() - 3);
      end = now;
    } else if (dateRange === "6m") {
      start = new Date(now);
      start.setMonth(start.getMonth() - 6);
      end = now;
    } else if (dateRange === "1y") {
      start = new Date(now);
      start.setFullYear(start.getFullYear() - 1);
      end = now;
    }
  } else if (isCustom) {
    if (!rawStartDate || !rawEndDate) {
      const err = new Error("Custom date range requires both start date and end date.");
      err.statusCode = 400;
      throw err;
    }

    start = new Date(rawStartDate);
    start.setHours(0, 0, 0, 0);

    end = new Date(rawEndDate);
    end.setHours(23, 59, 59, 999);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      const err = new Error("Invalid start or end date format provided.");
      err.statusCode = 400;
      throw err;
    }

    if (start > end) {
      const err = new Error("Start date cannot be after end date.");
      err.statusCode = 400;
      throw err;
    }

    // Enforce max span for custom range of 1 year (366 days max)
    const maxSpanMs = 366 * 24 * 60 * 60 * 1000;
    if (end.getTime() - start.getTime() > maxSpanMs) {
      const err = new Error("Custom date range cannot exceed 1 year (365 days). Please narrow your date range.");
      err.statusCode = 400;
      throw err;
    }
  } else {
    // If no dateRange preset or custom range is provided at all
    const err = new Error("Date range filter is mandatory for audit log exports. Please select a valid date range preset or custom date range.");
    err.statusCode = 400;
    throw err;
  }

  // 2. Build Prisma where clause
  const where = {};

  // Role Scoping Guard
  const actorRole = (actor?.primaryRole || actor?.role || "").toUpperCase();
  if (actorRole !== "SUPER_ADMIN") {
    if (actor?.companyId) {
      where.companyId = actor.companyId;
    }
  } else if (companyId) {
    where.companyId = Number(companyId);
  }

  if (branchId) where.branchId = Number(branchId);
  if (performedById) where.performedById = Number(performedById);

  // Mandatory Date Range filter
  where.createdAt = {
    gte: start,
    lte: end,
  };

  // Optional moduleName filter
  if (moduleName && moduleName.trim()) {
    where.moduleName = moduleName.trim();
  }

  // Optional actionType filter
  if (actionType && actionType.trim()) {
    const actTypeUpper = actionType.trim().toUpperCase();
    if (actTypeUpper === "LOGIN") {
      where.actionType = { in: ["LOGIN", "AUTH"] };
    } else if (actTypeUpper === "AUTH") {
      where.actionType = { in: ["AUTH", "LOGIN", "LOGOUT"] };
    } else {
      where.actionType = actTypeUpper;
    }
  }

  // Optional IP address filter
  if (ipAddress) {
    where.ipAddress = { contains: ipAddress, mode: "insensitive" };
  }

  // Optional global search
  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { action: { contains: q, mode: "insensitive" } },
      { actionType: { contains: q, mode: "insensitive" } },
      { moduleName: { contains: q, mode: "insensitive" } },
      { ipAddress: { contains: q, mode: "insensitive" } },
      { performedBy: { name: { contains: q, mode: "insensitive" } } },
      { performedBy: { email: { contains: q, mode: "insensitive" } } },
    ];
  }

  // 3. Row-Count Safety Check
  const count = await prisma.auditLog.count({ where });

  if (count > 10000) {
    const err = new Error(`Export exceeds maximum limit of 10,000 records (matched ${count.toLocaleString()} records). Please narrow your date range or filters.`);
    err.statusCode = 400;
    throw err;
  }

  // 4. Fetch logs matching where clause
  return await prisma.auditLog.findMany({
    where,
    take: 10000,
    orderBy: { createdAt: "desc" },
    include: {
      performedBy: {
        select: {
          id: true,
          name: true,
          email: true,
          profilePhoto: true,
        },
      },
      company: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      branch: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  });
};
