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
 * Seed default BANT criteria for a company if none exist
 */
export const ensureCompanyCriteriaSeeded = async (companyId) => {
  // Deduplicate existing duplicate criteria rows if any exist
  const allCriteria = await prisma.companyQualificationCriteria.findMany({
    where: { companyId, isActive: true },
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

  if (seenKeys.size === 0) {
    const dataToCreate = DEFAULT_QUALIFICATION_CRITERIA.map((item) => ({
      ...item,
      companyId,
      isActive: true,
    }));

    await prisma.companyQualificationCriteria.createMany({
      data: dataToCreate,
    });
  }

  const settings = await prisma.companyQualificationSettings.findUnique({
    where: { companyId },
  });

  if (!settings) {
    await prisma.companyQualificationSettings.create({
      data: {
        companyId,
        passThreshold: DEFAULT_SETTINGS.passThreshold,
        holdThreshold: DEFAULT_SETTINGS.holdThreshold,
        validStatuses: DEFAULT_SETTINGS.validStatuses,
      },
    });
  }
};

/**
 * Get active criteria for a company
 */
export const getCompanyCriteriaService = async (companyId) => {
  await ensureCompanyCriteriaSeeded(companyId);

  return prisma.companyQualificationCriteria.findMany({
    where: { companyId, isActive: true },
    orderBy: { displayOrder: 'asc' },
  });
};

/**
 * Get company threshold settings
 */
export const getCompanySettingsService = async (companyId) => {
  await ensureCompanyCriteriaSeeded(companyId);

  return prisma.companyQualificationSettings.findUnique({
    where: { companyId },
  });
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
 * Create a new criterion field
 */
export const createCriterionService = async (companyId, data) => {
  const existingKey = await prisma.companyQualificationCriteria.findFirst({
    where: { companyId, key: data.key, isActive: true },
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
    where: { companyId, isActive: true },
    orderBy: { displayOrder: 'desc' },
    select: { displayOrder: true },
  });

  const displayOrder = (maxOrder?.displayOrder || 0) + 1;

  return prisma.companyQualificationCriteria.create({
    data: {
      companyId,
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
};

/**
 * Update an existing criterion field
 */
export const updateCriterionService = async (companyId, id, data) => {
  const existing = await prisma.companyQualificationCriteria.findFirst({
    where: { id: Number(id), companyId, isActive: true },
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
 * Soft-delete a criterion field (Edge Case 5)
 */
export const softDeleteCriterionService = async (companyId, id) => {
  const existing = await prisma.companyQualificationCriteria.findFirst({
    where: { id: Number(id), companyId, isActive: true },
  });

  if (!existing) {
    throw new AppError('Criterion not found', 404);
  }

  return prisma.companyQualificationCriteria.update({
    where: { id: Number(id) },
    data: { isActive: false },
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
