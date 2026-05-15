import { z } from "zod"
import {
  OpenModalSchema,
  OpenCodeEditorSchema,
  ToolCallSchema,
  ToolCallsSchema,
} from "@/schemas/tools"

/**
 * Definition of a client-side tool.
 */
export interface ToolDefinition {
  name: string
  description: string
  parameters: z.ZodTypeAny
}

/**
 * The registry of all client-side tools.
 * Add new tools here to make them available to the AI.
 */
export const CLIENT_TOOLS: ToolDefinition[] = [
  {
    name: "openModal",
    description:
      "Opens a modal with specific text content for the user to read. Use this for announcements, instructions, or special notifications.",
    parameters: OpenModalSchema,
  },
  {
    name: "openCodeEditor",
    description:
      "Explicitly opens or focuses the code editor with specific initial code or instructions.",
    parameters: OpenCodeEditorSchema,
  },
]

/**
 * Helper to generate a Zod schema for tool calls.
 */
export const toolCallSchema = ToolCallSchema

/**
 * Helper to generate the combined tool call array schema.
 */
export const toolCallsSchema = ToolCallsSchema

/**
 * Helper to generate the tool descriptions for the system prompt.
 */
export function getToolPrompt(excludedTools: string[] = []) {
  const availableTools = CLIENT_TOOLS.filter(
    (t) => !excludedTools.includes(t.name),
  )

  if (availableTools.length === 0) return ""

  return `
CLIENT TOOLS:
You can trigger specific client-side UI actions using the "toolCalls" array.
Available tools:
${availableTools.map((t) => `- ${t.name}: ${t.description}`).join("\n")}

When using a tool, provide the exact parameters required by its schema.
`
}
