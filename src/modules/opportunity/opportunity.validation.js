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
 * Middleware factory for validating request body with Zod schema
 */
export const validateBody = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors.map((err) => ({
        field: err.path.join('.'),
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
