import { z } from "zod"

/**
 * Schema for creating a new Debate record.
 */
export const CreateDebateSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  content: z.string().optional(),
  judgeId: z.string().optional(),
  opponentId: z.string().optional(),
  opponentIds: z.array(z.string()).optional(),
})

/**
 * Schema for updating an existing Debate record.
 */
export const UpdateDebateSchema = CreateDebateSchema.partial()
