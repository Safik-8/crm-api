import { z } from "zod"

export const submitFeedbackSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(300, "Title is too long"),
  description: z.string().trim().default(""),
  category: z.enum(["BUG", "SUGGESTION", "OTHER"]).default("BUG"),
  priority: z.enum(["NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  pageUrl: z.string().trim().optional().nullable(),
  attachmentUrl: z.string().trim().optional().nullable()
})

export const updateFeedbackStatusSchema = z.object({
  status: z.enum(["NEW", "INVESTIGATING", "IN_PROGRESS", "WORKING", "TESTING", "COMPLETED", "RESOLVED"])
})

export const validateBody = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body)
    next()
  } catch (err) {
    if (err.errors) {
      return res.status(400).json({
        success: false,
        message: err.errors[0]?.message || "Validation error",
        errors: err.errors
      })
    }
    next(err)
  }
}
