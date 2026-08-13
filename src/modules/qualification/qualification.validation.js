import { z } from 'zod';

export const saveQualificationSchema = z
  .object({
    status: z.enum(['QUALIFIED', 'NOT_QUALIFIED', 'ON_HOLD', 'UNQUALIFIED']).optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
    remarks: z.string().max(1000).optional().nullable(),
  })
  .passthrough()
  .refine(
    (data) => {
      if (data.status === 'NOT_QUALIFIED' && (!data.remarks || !data.remarks.trim())) {
        return false;
      }
      if (data.status === 'ON_HOLD' && (!data.notes || !data.notes.trim())) {
        return false;
      }
      return true;
    },
    {
      message: "'NOT_QUALIFIED' status requires mandatory remarks, and 'ON_HOLD' requires mandatory notes.",
    }
  );
