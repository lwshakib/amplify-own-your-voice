import { getInterviewPrompt } from "./prompts"
import { getCharacter } from "@/lib/characters"
import { AgentInteraction, AuthUser, CoachParams, FeatureLogic } from "@/types/features"

export const interview_logic: FeatureLogic = {
  getPrompt: (interaction: AgentInteraction, user: AuthUser) => {
    const interviewData = interaction.interview!
    const character = getCharacter(interviewData.characterId || "sarah")
    const interviewerName = character
      ? `${character.firstName} ${character.lastName}`
      : "Sarah Thompson"
    return getInterviewPrompt(
      interviewerName,
      interviewData.type,
      interviewData.jobTitle,
      user.name || "Candidate",
      interviewData.description,
    )
  },
  getCoachPrompt: (params: CoachParams) => {
    const isTechnical = params.interviewType?.toUpperCase() === "TECHNICAL"
    return `You are an expert ${isTechnical ? "Technical" : "General"} Interview Coach. 
You are generating a first-person response for a candidate named "${params.candidateName || "Candidate"}" during a ${params.interviewType || "job"} interview for the position of "${params.jobTitle || "the Role"}".
Interviewer: "${params.interviewerName || "the Interviewer"}"

JOB DESCRIPTION / CONTEXT:
${params.jobDescription || "No specific job description provided."}

YOUR TASK:
Write exactly what the candidate ("${params.candidateName || "Candidate"}") should say next in response to the interviewer's last question. 
The response must be strategic, high-impact, and strictly derived from the provided context.

RULES FOR THE RESPONSE:
1. MATCH THE DEPTH: The length of your answer must be proportionate to the interviewer's question. 
2. NO BUZZWORDS: Avoid corporate clichés, generic buzzwords, or "AI-speak." Use natural, authentic, and direct language that sounds like a real person.
3. FIRST-PERSON ONLY: Write exclusively as the candidate. Do not include commentary, intros, or outros.
4. SPOKEN STYLE: Use plain text only. No markdown, no bolding, no lists. Just the words to be spoken.
5. CONTEXT-AWARE: Synthesize information from the entire conversation history, the job description, AND what the user has said so far in the current turn: "${params.currentTranscript || ""}".
6. REAL-TIME: If the user is mid-sentence, anticipate their next logical point. If they have finished a thought, provide a strong follow-up or pivot.`
  },
  getInterviewerName: (interaction: AgentInteraction) => {
    const character = getCharacter(
      interaction.interview?.characterId || "sarah",
    )
    return character
      ? `${character.firstName} ${character.lastName}`
      : "Sarah Thompson"
  },
  getModel: (interaction: AgentInteraction) => {
    const character = getCharacter(
      interaction.interview?.characterId || "sarah",
    )
    return character?.model || "luna"
  },
  speakerTitle: "Interviewer",
}
