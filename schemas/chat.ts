import { z } from "zod"
import { EvaluationPreprocessSchema } from "./common"

/**
 * Message part: Text
 */
export const TextPartSchema = z.object({
  type: z.literal("text"),
  text: z.string().describe("Your spoken message."),
  speakerName: z.string().optional().describe("The name of the speaker."),
  speakerTitle: z.string().optional().describe("The title of the speaker."),
  isUsersTurn: z
    .boolean()
    .default(true)
    .describe("Whether the next turn is the user's."),
})

/**
 * Message part: Tool Call
 */
export const ToolPartSchema = z.object({
  type: z.literal("tool"),
  name: z.string(),
  parameters: z.any(),
})

/**
 * Combined message part schema.
 */
export const MessagePartSchema = z.discriminatedUnion("type", [
  TextPartSchema,
  ToolPartSchema,
])

/**
 * The standard response schema for all chat-based AI interactions.
 */
export const AiResponseSchema = z.object({
  parts: z.array(MessagePartSchema).min(1),
  status: z.enum(["IN_PROGRESS", "COMPLETED"]),
  evaluation: EvaluationPreprocessSchema,
})

/**
 * Simple message structure for input history.
 */
export const SimpleMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
})

/**
 * Schema for a batch of messages.
 */
export const ChatBatchSchema = z.object({
  messages: z.array(SimpleMessageSchema),
})

/**
 * Schema for updating an existing message (e.g. adding audio after upload).
 */
export const UpdateMessageSchema = z.object({
  audioUrl: z.string().url().optional(),
  audioPath: z.string().optional(),
  audioPublicId: z.string().optional(),
})
