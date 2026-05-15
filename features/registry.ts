import { interview_logic } from "./interview/logic"
import { ai_persona_logic } from "./ai_persona/logic"
import { debate_logic } from "./debate/logic"
import { FeatureLogic } from "./types"

export type { FeatureLogic }

/**
 * FEATURE_LOGIC_REGISTRY
 * Contains only the logic parts of the features.
 * Safe to import on the server (API routes).
 */
export const FEATURE_LOGIC_REGISTRY: Record<string, FeatureLogic> = {
  INTERVIEW: interview_logic as FeatureLogic,
  AI_PERSONA: ai_persona_logic as FeatureLogic,
  DEBATE: debate_logic as FeatureLogic,
}

/**
 * Utility to get ONLY the logic for a feature.
 * Safe for Server Components and API Routes.
 */
export function getFeatureLogic(type: string): FeatureLogic | null {
  const normalizedKey = type.replace(/-/g, "_").toUpperCase()
  return FEATURE_LOGIC_REGISTRY[normalizedKey] || null
}
