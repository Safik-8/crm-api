import { z } from 'zod';

/**
 * Validation schema for creating a new Opportunity
 */
export const createOpportunitySchema = z.object({
  opportunityName: z
    .string({ required_error: 'Opportunity name is required' })
    .min(3, 'Opportunity name must be at least 3 characters')
    .max(100, 'Opportunity name cannot exceed 100 characters'),
  leadId: z
    .number({ required_error: 'Lead ID is required' })
    .int()
    .positive('Valid Lead ID is required'),
  productId: z.number().int().positive().nullable().optional(),
  teamId: z.number().int().positive().nullable().optional(),
  stageId: z
    .number()
    .int()
    .positive()
    .optional()
    .nullable(),
  expectedRevenue: z
    .number({ required_error: 'Expected revenue is required' })
    .positive('Expected revenue must be greater than 0'),
  probabilityPercentage: z
    .number()
    .int()
    .min(0, 'Probability must be at least 0%')
    .max(100, 'Probability cannot exceed 100%')
    .optional(),
  closingDate: z
    .string({ required_error: 'Target closing date is required' })
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid closing date format' }),
  notes: z.string().max(1000, 'Notes cannot exceed 1000 characters').optional(),
});

/**
 * Validation schema for updating an existing Opportunity
 */
export const updateOpportunitySchema = createOpportunitySchema.partial();

/**
 * Validation schema for closing an Opportunity (Won / Lost / Cancelled)
 */
export const closeOpportunitySchema = z.object({
  outcome: z.enum(['WON', 'LOST', 'CANCELLED'], {
    required_error: 'Outcome (WON, LOST, CANCELLED) is required',
  }),
  reasonId: z.number().int().positive().optional(),
  remarks: z.string().max(1000, 'Remarks cannot exceed 1000 characters').optional(),
});

/**
 * Validation schema for creating a new Opportunity Stage
 */
export const createOpportunityStageSchema = z.object({
  name: z
    .string({ required_error: 'Stage name is required' })
    .min(3, 'Stage name must be at least 3 characters')
    .max(50, 'Stage name cannot exceed 50 characters'),
  companyId: z
    .number()
    .int()
    .positive()
    .optional(),
  code: z
    .string()
    .max(50, 'Stage code cannot exceed 50 characters')
    .optional(),
  displayOrder: z
    .number()
    .int()
    .min(0, 'Display order must be at least 0')
    .optional(),
  colorCode: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Color code must be a valid 6-character hex color (e.g. #6366f1)')
    .optional(),
  defaultProbabilityPct: z
    .number()
    .int()
    .min(0, 'Probability must be at least 0%')
    .max(100, 'Probability cannot exceed 100%')
    .optional(),
  stageType: z
    .enum(['REGULAR', 'QUALIFICATION', 'WON', 'LOST', 'CANCELLED'])
    .optional(),
});

/**
 * Validation schema for updating an existing Opportunity Stage
 */
export const updateOpportunityStageSchema = createOpportunityStageSchema.partial();

/**
 * Validation schema for bulk reordering/updating Opportunity Stages
 */
export const bulkOpportunityStagesSchema = z.object({
  companyId: z.number().int().positive().optional(),
  stageOrders: z.array(
    z.object({
      id: z.number().int().positive(),
      displayOrder: z.number().int().min(0),
      status: z.enum(['ACTIVE', 'INACTIVE']),
    })
  ).min(1, 'At least one stage order is required'),
});

/**
 * Validation schema for moving an Opportunity to a new Stage
 */
export const moveOpportunityStageSchema = z.object({
  newStageId: z
    .number({ required_error: 'New Stage ID is required' })
    .int()
    .positive('Valid Stage ID is required'),
  remarks: z.string().max(1000, 'Remarks cannot exceed 1000 characters').optional(),
  reasonId: z.number().int().positive().optional(),
});

/**
 * Middleware factory for validating request body with Zod schema
 */
export const validateBody = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError || error.errors) {
      const formattedErrors = (error.errors || []).map((err) => ({
        field: err.path ? err.path.join('.') : '',
        message: err.message,
      }));
      return res.status(400).json({
        success: false,
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: formattedErrors,
        timestamp: new Date().toISOString(),
      });
    }
    next(error);
  }
};

