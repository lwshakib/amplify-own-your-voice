import { z } from "zod"

/**
 * Schema for the openModal tool.
 */
export const OpenModalSchema = z.object({
  title: z.string().optional(),
  content: z.string().describe("The text content to display in the modal."),
})

/**
 * Schema for the openCodeEditor tool.
 */
export const OpenCodeEditorSchema = z.object({
  code: z.string().describe("The initial code to populate the editor with."),
  language: z.enum(["javascript", "python", "cpp"]).default("javascript"),
  title: z
    .string()
    .optional()
    .describe("Title for the code challenge or task."),
  description: z
    .string()
    .optional()
    .describe("Description of what the user needs to do."),
})

/**
 * Generic tool call structure.
 */
export const ToolCallSchema = z.object({
  name: z.string(),
  parameters: z.record(z.string(), z.unknown()),
})

/**
 * Array of tool calls.
 */
export const ToolCallsSchema = z.array(ToolCallSchema).optional()
