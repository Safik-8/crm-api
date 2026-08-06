import { z } from 'zod';

export const saveQualificationSchema = z.object({
  budgetAvailable: z.boolean(),
  interestLevel: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  purchaseTimeline: z.enum(['IMMEDIATE', '1_MONTH', '3_MONTHS', 'EXPLORATORY']).nullable(),
  decisionMakerAvailable: z.boolean(),
  productFit: z.boolean(),
  status: z.enum(['QUALIFIED', 'NOT_QUALIFIED', 'ON_HOLD', 'UNQUALIFIED']).optional(),
  notes: z.string().max(1000).optional(),
  remarks: z.string().max(1000).optional(),
}).refine((data) => {
  if (data.status === 'NOT_QUALIFIED' && (!data.remarks || !data.remarks.trim())) {
    return false;
  }
  if (data.status === 'ON_HOLD' && (!data.notes || !data.notes.trim())) {
    return false;
  }
  return true;
}, {
  message: "Subtask 1.4 Rule Violation: 'Not Qualified' requires mandatory remarks, and 'On Hold' requires mandatory notes.",
});
