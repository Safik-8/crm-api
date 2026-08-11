/**
 * Qualification Module Configuration
 *
 * Provides a dynamic configuration matrix for lead qualification scoring,
 * pass thresholds, factor weights, and validation requirements.
 * Configurable for future business changes.
 */

export const DEFAULT_QUALIFICATION_CONFIG = {
  // Qualifying score threshold (0 - 100)
  passThreshold: 60,

  // Criteria factor weights (Sum = 100 points)
  weights: {
    budgetAvailable: 25,
    decisionMakerAvailable: 15,
    productFit: 15,
    interestLevel: {
      HIGH: 25,
      MEDIUM: 15,
      LOW: 5,
    },
    purchaseTimeline: {
      IMMEDIATE: 20,
      '1_MONTH': 15,
      '3_MONTHS': 10,
      EXPLORATORY: 5,
    },
  },

  // Dynamic factor descriptions for UI guidance
  factors: [
    { key: 'budgetAvailable', label: 'Budget Availability', maxPoints: 25, type: 'boolean' },
    { key: 'interestLevel', label: 'Interest Level', maxPoints: 25, type: 'select' },
    { key: 'purchaseTimeline', label: 'Purchase Timeline', maxPoints: 20, type: 'select' },
    { key: 'decisionMakerAvailable', label: 'Decision Maker Reached', maxPoints: 15, type: 'boolean' },
    { key: 'productFit', label: 'Product / Service Fit', maxPoints: 15, type: 'boolean' },
  ],

  // Mandatory business validation rules by status
  mandatoryRules: {
    NOT_QUALIFIED: { requireRemarks: true, message: 'Remarks are required when marking a lead as Not Qualified' },
    ON_HOLD: { requireNotes: true, message: 'Notes are required when placing a lead On Hold' },
  },

  // Allowed qualification outcome statuses
  validStatuses: ['QUALIFIED', 'NOT_QUALIFIED', 'ON_HOLD', 'UNQUALIFIED'],
};

/**
 * Dynamically computes qualification score using configured factor weights.
 */
export const calculateDynamicScore = (data, config = DEFAULT_QUALIFICATION_CONFIG) => {
  const { weights } = config;
  let score = 0;

  if (Boolean(data.budgetAvailable)) {
    score += weights.budgetAvailable || 0;
  }
  if (Boolean(data.decisionMakerAvailable)) {
    score += weights.decisionMakerAvailable || 0;
  }
  if (Boolean(data.productFit)) {
    score += weights.productFit || 0;
  }

  if (data.interestLevel && weights.interestLevel?.[data.interestLevel] !== undefined) {
    score += weights.interestLevel[data.interestLevel];
  }

  if (data.purchaseTimeline && weights.purchaseTimeline?.[data.purchaseTimeline] !== undefined) {
    score += weights.purchaseTimeline[data.purchaseTimeline];
  }

  return Math.min(100, Math.max(0, score));
};

/**
 * Determines outcome status dynamically based on score and explicit overrides.
 */
export const determineDynamicStatus = (data, score, config = DEFAULT_QUALIFICATION_CONFIG) => {
  const explicitStatus = data.status;
  
  // Explicit manual overrides for ON_HOLD / UNQUALIFIED
  if (explicitStatus === 'ON_HOLD' || explicitStatus === 'UNQUALIFIED') {
    return explicitStatus;
  }

  // Automatic score threshold evaluation
  return score >= config.passThreshold ? 'QUALIFIED' : 'NOT_QUALIFIED';
};
