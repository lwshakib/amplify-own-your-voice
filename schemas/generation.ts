import { z } from "zod"

/**
 * Schema for generating a debate motion.
 */
export const DebateMotionSchema = z.object({
  prompt: z.string().min(1, "Topic is required"),
})

/**
 * Schema for generating a job description.
 */
export const JobDescriptionGenerationSchema = z.object({
  jobTitle: z.string().min(1, "Job title is required"),
  type: z.enum(["TECHNICAL", "GENERAL"]).optional(),
})
