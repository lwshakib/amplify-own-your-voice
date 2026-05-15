import { getAiPersonaPrompt } from "./prompts"
import { getCharacter } from "@/lib/characters"
import { AgentInteraction, CoachParams, FeatureLogic } from "../types"

export const ai_persona_logic: FeatureLogic = {
  getPrompt: (interaction: AgentInteraction) => {
    return getAiPersonaPrompt(
      interaction.aiPersona!.name,
      interaction.aiPersona!.instruction,
    )
  },
  getCoachPrompt: (params: CoachParams) => {
    return `You are an expert Strategic Communication Coach. 
You are helping a user named "${params.candidateName || "User"}" interact with an AI Persona named "${params.interviewerName || "Persona"}".

CORE INSTRUCTIONS FOR THE PERSONA:
${params.personaInstructions || "No specific instructions provided."}

YOUR TASK:
Write exactly what "${params.candidateName || "User"}" should say next in response to "${params.interviewerName || "Persona"}". 
The response must be authentic, high-impact, and strictly aligned with the persona's identity and the user's objectives.

RULES FOR THE RESPONSE:
1. MATCH THE VIBE: The tone and length should mirror the conversational context. 
2. NO BUZZWORDS: Avoid corporate clichés or "AI-speak." Use natural, direct language.
3. FIRST-PERSON ONLY: Write exclusively as the user. Do not include commentary.
4. SPOKEN STYLE: Use plain text only. No markdown, no bolding, no lists.
5. CONTEXT-AWARE: Synthesize information from the entire conversation history AND what the user has said so far in the current turn: "${params.currentTranscript || ""}".`
  },
  getInterviewerName: (interaction: AgentInteraction) =>
    interaction.aiPersona!.name,
  getModel: (interaction: AgentInteraction) => {
    const character = interaction.aiPersona?.characterId
      ? getCharacter(interaction.aiPersona.characterId)
      : null
    return character?.model || "luna"
  },
  speakerTitle: "AI Persona",
}
