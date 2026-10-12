import prisma from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';

export const DEFAULT_QUALIFICATION_CRITERIA = [
  {
    key: 'budgetAvailable',
    label: 'Budget Available (₹)',
    description: 'Client has confirmed budget availability in ₹',
    fieldType: 'boolean',
    maxPoints: 25,
    options: null,
    defaultValue: 'false',
    isRequired: false,
    displayOrder: 1,
  },
  {
    key: 'interestLevel',
    label: 'Interest Level',
    description: 'Client engagement and purchase intent level',
    fieldType: 'select',
    maxPoints: 25,
    options: [
      { value: 'HIGH', label: 'High', points: 25 },
      { value: 'MEDIUM', label: 'Medium', points: 15 },
      { value: 'LOW', label: 'Low', points: 5 },
    ],
    defaultValue: 'MEDIUM',
    isRequired: true,
    displayOrder: 2,
  },
  {
    key: 'purchaseTimeline',
    label: 'Purchase Timeline',
    description: 'Expected buying and decision timeframe',
    fieldType: 'select',
    maxPoints: 20,
    options: [
      { value: 'IMMEDIATE', label: 'Immediate', points: 20 },
      { value: '1_MONTH', label: 'Within 1 Month', points: 15 },
      { value: '3_MONTHS', label: 'Within 3 Months', points: 10 },
      { value: 'EXPLORATORY', label: 'Exploratory', points: 5 },
    ],
    defaultValue: '',
    isRequired: false,
    displayOrder: 3,
  },
  {
    key: 'decisionMakerAvailable',
    label: 'Decision Maker Reached',
    description: 'Direct contact with final decision maker',
    fieldType: 'boolean',
    maxPoints: 15,
    options: null,
    defaultValue: 'false',
    isRequired: false,
    displayOrder: 4,
  },
  {
    key: 'productFit',
    label: 'Product / Service Fit',
    description: 'Requirements align with product capabilities',
    fieldType: 'boolean',
    maxPoints: 15,
    options: null,
    defaultValue: 'false',
    isRequired: false,
    displayOrder: 5,
  },
];

export const DEFAULT_SETTINGS = {
  passThreshold: 60,
  holdThreshold: 40,
  validStatuses: ['QUALIFIED', 'NOT_QUALIFIED', 'ON_HOLD', 'UNQUALIFIED'],
};

/**
 * Seed default BANT qualification criteria for multiple companies in bulk.
 * Called at startup (via initSystem.js) for high performance over remote database connections.
 */
export const batchEnsureCompaniesCriteriaSeeded = async (companyIds) => {
  if (!companyIds || companyIds.length === 0) return;

  const [allCriteria, allSettings] = await Promise.all([
    prisma.companyQualificationCriteria.findMany({
      where: { companyId: { in: companyIds }, isActive: true },
      orderBy: { id: 'asc' },
    }),
    prisma.companyQualificationSettings.findMany({
      where: { companyId: { in: companyIds } },
    }),
  ]);

  const criteriaByCompany = new Map();
  for (const c of allCriteria) {
    if (!criteriaByCompany.has(c.companyId)) criteriaByCompany.set(c.companyId, []);
    criteriaByCompany.get(c.companyId).push(c);
  }

  const existingSettingsCompanyIds = new Set(allSettings.map(s => s.companyId));
  const missingCriteriaData = [];
  const duplicateIdsToDelete = [];

  for (const companyId of companyIds) {
    const list = criteriaByCompany.get(companyId) || [];
    const seenKeys = new Set();
    list.forEach((c) => {
      if (seenKeys.has(c.key)) {
        duplicateIdsToDelete.push(c.id);
      } else {
        seenKeys.add(c.key);
      }
    });

    // Backfill any missing default criteria (handles both 0 criteria and partial criteria)
    const missingItems = DEFAULT_QUALIFICATION_CRITERIA.filter(item => !seenKeys.has(item.key));
    for (const item of missingItems) {
      missingCriteriaData.push({
        ...item,
        companyId,
        isActive: true,
      });
    }
  }

  const missingSettingsData = companyIds
    .filter(id => !existingSettingsCompanyIds.has(id))
    .map(companyId => ({
      companyId,
      passThreshold: DEFAULT_SETTINGS.passThreshold,
      holdThreshold: DEFAULT_SETTINGS.holdThreshold,
      validStatuses: DEFAULT_SETTINGS.validStatuses,
    }));

  // Execute deduplication deletes sequentially first to prevent race condition with inserts
  if (duplicateIdsToDelete.length > 0) {
    await prisma.companyQualificationCriteria.deleteMany({
      where: { id: { in: duplicateIdsToDelete } },
    });
  }

  // Execute missing criteria and settings creation in parallel
  const createOps = [];
  if (missingCriteriaData.length > 0) {
    createOps.push(
      prisma.companyQualificationCriteria.createMany({
        data: missingCriteriaData,
        skipDuplicates: true,
      })
    );
  }
  if (missingSettingsData.length > 0) {
    createOps.push(
      prisma.companyQualificationSettings.createMany({
        data: missingSettingsData,
        skipDuplicates: true,
      })
    );
  }

  if (createOps.length > 0) {
    await Promise.all(createOps);
  }
};

// In-flight seeding promise tracker to prevent concurrent initialization race conditions
const inFlightSeedingPromises = new Map();

/**
 * Seed default BANT qualification criteria for a company — idempotent and concurrency-safe.
 */
export const ensureCompanyCriteriaSeeded = async (companyId) => {
  const numericCompanyId = Number(companyId);
  if (!numericCompanyId) return;

  if (inFlightSeedingPromises.has(numericCompanyId)) {
    return inFlightSeedingPromises.get(numericCompanyId);
  }

  const seedingPromise = (async () => {
    // 1. Deduplicate any duplicate criteria rows that may exist
    const allCriteria = await prisma.companyQualificationCriteria.findMany({
      where: { companyId: numericCompanyId, isActive: true },
      orderBy: { id: 'asc' },
    });

    const seenKeys = new Set();
    const duplicateIds = [];
    allCriteria.forEach((c) => {
      if (seenKeys.has(c.key)) {
        duplicateIds.push(c.id);
      } else {
        seenKeys.add(c.key);
      }
    });

    if (duplicateIds.length > 0) {
      await prisma.companyQualificationCriteria.deleteMany({
        where: { id: { in: duplicateIds } },
      });
    }

    // 2. Seed default BANT criteria only if none exist for this company
    if (seenKeys.size === 0) {
      await prisma.companyQualificationCriteria.createMany({
        data: DEFAULT_QUALIFICATION_CRITERIA.map((item) => ({
          ...item,
          companyId: numericCompanyId,
          isActive: true,
        })),
        skipDuplicates: true,
      });
    }

    // 3. Atomically upsert company qualification threshold settings to prevent P2002 conflicts
    await prisma.companyQualificationSettings.upsert({
      where: { companyId: numericCompanyId },
      update: {},
      create: {
        companyId: numericCompanyId,
        passThreshold: DEFAULT_SETTINGS.passThreshold,
        holdThreshold: DEFAULT_SETTINGS.holdThreshold,
        validStatuses: DEFAULT_SETTINGS.validStatuses,
      },
    });
  })().finally(() => {
    inFlightSeedingPromises.delete(numericCompanyId);
  });

  inFlightSeedingPromises.set(numericCompanyId, seedingPromise);
  return seedingPromise;
};

/**
 * Get active criteria for a company (Fast direct read with self-healing lazy fallback and automatic deduplication)
 */
export const getCompanyCriteriaService = async (companyId) => {
  const numericCompanyId = Number(companyId);
  let criteria = await prisma.companyQualificationCriteria.findMany({
    where: { companyId: numericCompanyId, isActive: true },
    orderBy: { displayOrder: 'asc' },
  });

  if (!criteria || criteria.length === 0) {
    await ensureCompanyCriteriaSeeded(numericCompanyId);
    criteria = await prisma.companyQualificationCriteria.findMany({
      where: { companyId: numericCompanyId, isActive: true },
      orderBy: { displayOrder: 'asc' },
    });
  }

  // Defensive self-healing deduplication by key
  const seenKeys = new Set();
  const uniqueCriteria = [];
  const duplicateIdsToDelete = [];

  for (const c of criteria) {
    if (seenKeys.has(c.key)) {
      duplicateIdsToDelete.push(c.id);
    } else {
      seenKeys.add(c.key);
      uniqueCriteria.push(c);
    }
  }

  if (duplicateIdsToDelete.length > 0) {
    prisma.companyQualificationCriteria.deleteMany({
      where: { id: { in: duplicateIdsToDelete } },
    }).catch((err) => console.error('Background cleanup of duplicate criteria failed:', err));
  }

  return uniqueCriteria;
};

/**
 * Get company threshold settings (Fast direct read with self-healing lazy fallback)
 */
export const getCompanySettingsService = async (companyId) => {
  const numericCompanyId = Number(companyId);
  let settings = await prisma.companyQualificationSettings.findUnique({
    where: { companyId: numericCompanyId },
  });

  if (!settings) {
    await ensureCompanyCriteriaSeeded(numericCompanyId);
    settings = await prisma.companyQualificationSettings.findUnique({
      where: { companyId: numericCompanyId },
    });
  }

  return settings;
};

/**
 * Helper: Largest Remainder Algorithm for exact 100 pt integer balancing (QA Edge Case 7)
 */
export const calculateBalancedWeights = (criteria) => {
  if (!Array.isArray(criteria) || criteria.length === 0) return [];

  const total = criteria.reduce((sum, item) => sum + (Number(item.maxPoints) || 0), 0);
  if (total === 0) {
    const equalShare = Math.floor(100 / criteria.length);
    let rem = 100 - equalShare * criteria.length;
    return criteria.map((c, i) => {
      const newMax = equalShare + (i < rem ? 1 : 0);
      let newOptions = c.options;
      if (c.fieldType === 'select' && Array.isArray(c.options)) {
        newOptions = c.options.map((opt) => ({
          ...opt,
          points: Math.min(newMax, Number(opt.points) || 0),
        }));
      }
      return { ...c, maxPoints: newMax, options: newOptions };
    });
  }

  // Calculate proportional points
  const rawWeights = criteria.map((item) => {
    const raw = ((Number(item.maxPoints) || 0) / total) * 100;
    return {
      key: item.key,
      maxPoints: Number(item.maxPoints) || 0,
      raw,
      floor: Math.floor(raw),
      remainder: raw - Math.floor(raw),
    };
  });

  const sumFloors = rawWeights.reduce((sum, item) => sum + item.floor, 0);
  let remainderToDistribute = 100 - sumFloors;

  // Largest remainder sorting
  const roundedItems = [...rawWeights].sort((a, b) => b.remainder - a.remainder);

  for (let i = 0; i < remainderToDistribute; i++) {
    if (roundedItems[i]) {
      roundedItems[i].floor += 1;
    }
  }

  const weightMap = new Map(roundedItems.map((item) => [item.key, item.floor]));

  return criteria.map((c) => {
    const newMax = weightMap.get(c.key) ?? c.maxPoints;
    const oldMax = c.maxPoints || 1;

    let newOptions = c.options;
    if (c.fieldType === 'select' && Array.isArray(c.options)) {
      newOptions = c.options.map((opt) => {
        const scaled = oldMax > 0 ? Math.round((Number(opt.points) || 0) * (newMax / oldMax)) : newMax;
        return {
          ...opt,
          points: Math.min(newMax, Math.max(0, scaled)),
        };
      });
    }

    return {
      ...c,
      maxPoints: newMax,
      options: newOptions,
    };
  });
};

/**
 * Create a new criterion field and atomically rebalance active criteria to 100 points
 */
export const createCriterionService = async (companyId, data) => {
  const numericCompanyId = Number(companyId);
  const existingKey = await prisma.companyQualificationCriteria.findFirst({
    where: { companyId: numericCompanyId, key: data.key, isActive: true },
  });

  if (existingKey) {
    throw new AppError(`Criterion key "${data.key}" already exists for your company.`, 400);
  }

  // Validate option point cap (QA Edge Case 10)
  if (data.fieldType === 'select' && Array.isArray(data.options)) {
    for (const opt of data.options) {
      if (Number(opt.points) > Number(data.maxPoints)) {
        throw new AppError(`Option "${opt.label}" points (${opt.points}) cannot exceed field max points (${data.maxPoints}).`, 400);
      }
    }
  }

  const maxOrder = await prisma.companyQualificationCriteria.findFirst({
    where: { companyId: numericCompanyId, isActive: true },
    orderBy: { displayOrder: 'desc' },
    select: { displayOrder: true },
  });

  const displayOrder = (maxOrder?.displayOrder || 0) + 1;

  return prisma.$transaction(async (tx) => {
    const created = await tx.companyQualificationCriteria.create({
      data: {
        companyId: numericCompanyId,
        key: data.key,
        label: data.label,
        description: data.description || null,
        fieldType: data.fieldType,
        maxPoints: Number(data.maxPoints) || 0,
        options: data.options || null,
        defaultValue: data.defaultValue !== undefined ? String(data.defaultValue) : null,
        isRequired: Boolean(data.isRequired),
        isActive: true,
        displayOrder,
      },
    });

    // Auto-balance all active criteria so the matrix remains at exactly 100 points
    const activeList = await tx.companyQualificationCriteria.findMany({
      where: { companyId: numericCompanyId, isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    const balanced = calculateBalancedWeights(activeList);
    for (const item of balanced) {
      await tx.companyQualificationCriteria.update({
        where: { id: item.id },
        data: {
          maxPoints: item.maxPoints,
          options: item.options || undefined,
        },
      });
    }

    return created;
  });
};

/**
 * Update an existing criterion field
 */
export const updateCriterionService = async (companyId, id, data) => {
  const numericCompanyId = Number(companyId);
  const existing = await prisma.companyQualificationCriteria.findFirst({
    where: { id: Number(id), companyId: numericCompanyId, isActive: true },
  });

  if (!existing) {
    throw new AppError('Criterion not found', 404);
  }

  const newMaxPoints = data.maxPoints !== undefined ? Number(data.maxPoints) : existing.maxPoints;
  const newOptions = data.options !== undefined ? data.options : existing.options;

  // Validate option point cap (QA Edge Case 10)
  if ((data.fieldType || existing.fieldType) === 'select' && Array.isArray(newOptions)) {
    for (const opt of newOptions) {
      if (Number(opt.points) > newMaxPoints) {
        throw new AppError(`Option "${opt.label}" points (${opt.points}) cannot exceed field max points (${newMaxPoints}).`, 400);
      }
    }
  }

  return prisma.companyQualificationCriteria.update({
    where: { id: Number(id) },
    data: {
      label: data.label ?? existing.label,
      description: data.description !== undefined ? data.description : existing.description,
      maxPoints: newMaxPoints,
      options: newOptions,
      defaultValue: data.defaultValue !== undefined ? String(data.defaultValue) : existing.defaultValue,
      isRequired: data.isRequired !== undefined ? Boolean(data.isRequired) : existing.isRequired,
      displayOrder: data.displayOrder !== undefined ? Number(data.displayOrder) : existing.displayOrder,
    },
  });
};

/**
 * Soft-delete a criterion field and atomically rebalance remaining criteria to 100 points
 */
export const softDeleteCriterionService = async (companyId, id) => {
  const numericCompanyId = Number(companyId);
  const existing = await prisma.companyQualificationCriteria.findFirst({
    where: { id: Number(id), companyId: numericCompanyId, isActive: true },
  });

  if (!existing) {
    throw new AppError('Criterion not found', 404);
  }

  return prisma.$transaction(async (tx) => {
    await tx.companyQualificationCriteria.update({
      where: { id: Number(id) },
      data: { isActive: false },
    });

    // Auto-balance remaining active criteria so total weights equal exactly 100 points
    const remainingActive = await tx.companyQualificationCriteria.findMany({
      where: { companyId: numericCompanyId, isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    if (remainingActive.length > 0) {
      const balanced = calculateBalancedWeights(remainingActive);
      for (const item of balanced) {
        await tx.companyQualificationCriteria.update({
          where: { id: item.id },
          data: {
            maxPoints: item.maxPoints,
            options: item.options || undefined,
          },
        });
      }
    }
  });
};

/**
 * Batch update entire criteria matrix & validate sum = 100 (Edge Case 2)
 */
export const saveCompanyCriteriaMatrixService = async (companyId, criteriaList) => {
  if (!Array.isArray(criteriaList) || criteriaList.length === 0) {
    throw new AppError('Criteria list cannot be empty', 400);
  }

  const totalPoints = criteriaList.reduce((sum, item) => sum + (Number(item.maxPoints) || 0), 0);
  if (totalPoints !== 100) {
    throw new AppError(`Total criteria weights must equal exactly 100 points (Current sum: ${totalPoints}). Please use Auto-Balance or adjust weights.`, 400);
  }

  // Auto-clamp option points to maxPoints if needed during rebalancing
  for (const item of criteriaList) {
    if (item.fieldType === 'select' && Array.isArray(item.options)) {
      const maxPts = Number(item.maxPoints) || 0;
      item.options = item.options.map((opt) => ({
        ...opt,
        points: Math.min(maxPts, Math.max(0, Number(opt.points) || 0)),
      }));
    }
  }

  return prisma.$transaction(async (tx) => {
    const updated = [];
    for (let i = 0; i < criteriaList.length; i++) {
      const item = criteriaList[i];
      if (item.id) {
        const res = await tx.companyQualificationCriteria.update({
          where: { id: Number(item.id) },
          data: {
            label: item.label,
            description: item.description || null,
            maxPoints: Number(item.maxPoints) || 0,
            options: item.options || null,
            defaultValue: item.defaultValue !== undefined ? String(item.defaultValue) : null,
            isRequired: Boolean(item.isRequired),
            displayOrder: i + 1,
          },
        });
        updated.push(res);
      }
    }
    return updated;
  });
};

/**
 * Update company threshold settings
 */
export const updateCompanySettingsService = async (companyId, data) => {
  const passThreshold = Number(data.passThreshold);
  const holdThreshold = Number(data.holdThreshold);

  if (isNaN(passThreshold) || passThreshold < 1 || passThreshold > 100) {
    throw new AppError('Pass threshold must be a number between 1 and 100', 400);
  }

  return prisma.companyQualificationSettings.upsert({
    where: { companyId },
    update: {
      passThreshold,
      holdThreshold: !isNaN(holdThreshold) ? holdThreshold : 40,
    },
    create: {
      companyId,
      passThreshold,
      holdThreshold: !isNaN(holdThreshold) ? holdThreshold : 40,
      validStatuses: DEFAULT_SETTINGS.validStatuses,
    },
  });
};
