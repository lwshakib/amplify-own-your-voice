import { z } from "zod"

/**
 * Common metrics for session evaluation.
 */
export const EvaluationMetricsSchema = z.object({
  correctness: z.number().min(0).max(100).default(50),
  clarity: z.number().min(0).max(100).default(50),
  relevance: z.number().min(0).max(100).default(50),
  detail: z.number().min(0).max(100).default(50),
  efficiency: z.number().min(0).max(100).default(50),
  creativity: z.number().min(0).max(100).default(50),
  communication: z.number().min(0).max(100).default(50),
  problemSolving: z.number().min(0).max(100).default(50),
})

/**
 * Evaluation structure included in AI responses.
 */
export const EvaluationSchema = z
  .object({
    feedback: z.string().default("Professional performance."),
    metrics: EvaluationMetricsSchema,
  })
  .nullable()

/**
 * Helper to handle "empty object" scenarios from LLMs for evaluation.
 */
export const EvaluationPreprocessSchema = z.preprocess(
  (val) =>
    val && typeof val === "object" && Object.keys(val).length === 0
      ? null
      : val,
  EvaluationSchema,
)

/**
 * Schema for TTS (Text-to-Speech) requests.
 */
export const TtsSchema = z.object({
  text: z.string().min(1, "Text is required"),
  voice: z.string().optional(),
})
