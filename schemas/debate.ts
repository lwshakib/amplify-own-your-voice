import { z } from "zod"
import { EvaluationPreprocessSchema } from "./common"

/**
 * Standard flat response schema for Debates.
 * Note: This project is moving towards the "parts" based AiResponseSchema,
 * but Debates currently use this flatter structure.
 */
export const DebateResponseSchema = z.object({
  text: z
    .string()
    .describe(
      "The spoken content of the current speaker. Max 1500 characters. USE \\n FOR NEWLINES, DO NOT USE RAW NEWLINES.",
    ),
  speakerName: z.string().describe("The full name of the current character."),
  speakerTitle: z.string().describe("The role (Judge, Prime Minister, etc.)"),
  status: z.enum(["IN_PROGRESS", "COMPLETED"]),
  isUsersTurn: z
    .boolean()
    .describe(
      "true if the USER is the very next speaker to be invited or to speak.",
    ),
  evaluation: EvaluationPreprocessSchema,
})

/**
 * Schema for starting a new debate session.
 */
export const CreateDebateSessionSchema = z.object({
  userSide: z.enum(["PRO", "OPP"]).nullable().optional(),
})
