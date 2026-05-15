import { z } from "zod"

/**
 * Schema for generating AI persona information (name, instructions, etc.).
 */
export const PersonaInfoSchema = z.object({
  name: z
    .string()
    .describe(
      "A professional and catchy name for the agent (1-3 words). MUST NOT be a person's name like 'Sarah'.",
    ),
  instructions: z
    .string()
    .describe("Comprehensive system instructions for the agent."),
  character_id: z
    .string()
    .optional()
    .describe(
      "The ID of the character whose voice best fits this agent (only for new agents).",
    ),
})

/**
 * Schema for creating a new AI Persona record.
 */
export const CreatePersonaSchema = z.object({
  name: z.string().min(1, "Name is required"),
  instruction: z.string().min(1, "Instruction is required"),
  characterId: z.string().optional(),
  avatar: z
    .object({
      url: z.string(),
      path: z.string().optional(),
      publicId: z.string().optional(),
    })
    .nullable()
    .optional(),
})

/**
 * Schema for updating an existing AI Persona record.
 */
export const UpdatePersonaSchema = CreatePersonaSchema.partial()

/**
 * Schema for generating an avatar for an AI Persona.
 */
export const GenerateAvatarSchema = z.object({
  name: z.string().min(1, "Name is required"),
  instruction: z.string().min(1, "Instruction is required"),
  goal: z.string().optional(),
  customPrompt: z.string().optional(),
})

/**
 * Schema for the input to the generate-info endpoint.
 */
export const GeneratePersonaInfoInputSchema = z
  .object({
    description: z.string().optional(),
    goal: z.string().optional(),
    name: z.string().optional(),
    existingInstructions: z.string().optional(),
  })
  .refine((data) => data.goal || data.description, {
    message: "Goal or description is required",
  })
