import { z } from "zod"

/**
 * Schema for creating a new Interview record.
 */
export const CreateInterviewSchema = z.object({
  jobTitle: z.string().min(1, "Job title is required"),
  description: z.string().min(1, "Job description is required"),
  type: z.enum(["TECHNICAL", "GENERAL"]).default("TECHNICAL"),
  characterId: z.string().optional(),
})

/**
 * Schema for updating an existing Interview record.
 */
export const UpdateInterviewSchema = CreateInterviewSchema.partial()
