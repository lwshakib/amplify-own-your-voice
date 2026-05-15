import { z } from "zod"

/**
 * Schema for creating a new session (AgentInteraction).
 */
export const CreateSessionSchema = z
  .object({
    interviewId: z.string().optional(),
    debateId: z.string().optional(),
    aiPersonaId: z.string().optional(),
    type: z.string().optional(), // Frontend might pass a type, but we usually infer it
  })
  .refine((data) => data.interviewId || data.debateId || data.aiPersonaId, {
    message: "One of interviewId, debateId, or aiPersonaId must be provided",
  })

/**
 * Schema for updating an existing session.
 */
export const UpdateSessionSchema = z.object({
  status: z.enum(["IN_PROGRESS", "COMPLETED"]).optional(),
  userSide: z.enum(["PRO", "OPP"]).nullable().optional(),
  duration: z.number().optional(),
})
