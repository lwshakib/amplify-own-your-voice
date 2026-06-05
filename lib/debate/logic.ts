import { getDebatePrompt } from "./prompts"
import {
  AgentInteraction,
  AuthUser,
  Message,
  CoachParams,
  FeatureLogic,
} from "@/types/features"
import { getCharacter, CHARACTERS } from "@/lib/characters"

export const debate_logic: FeatureLogic = {
  getPrompt: (
    interaction: AgentInteraction,
    user: AuthUser,
    _messages: Message[],
  ) => {
    const judge = getCharacter(interaction.debate?.judgeId || "ethan")
    const leadId = interaction.debate?.opponentId || "sophia"
    const lead = getCharacter(leadId) || CHARACTERS[0]

    // Pick two more characters that aren't lead or judge
    const judgeId = interaction.debate?.judgeId || "ethan"
    const available = CHARACTERS.filter(
      (c) => c.id !== lead.id && c.id !== judgeId,
    )
    const deputy = available[0] || CHARACTERS[1]
    const whip = available[1] || CHARACTERS[2]

    const userName = user.name || "User"
    const isUserPro = interaction.userSide === "PRO"

    const rolesSequence = [
      { id: 1, speaker: judge, role: "Judge", title: "Judge Opening" },
      {
        id: 2,
        speaker: isUserPro ? { firstName: userName } : lead,
        role: "Prime Minister",
        title: "Prime Minister Speech",
      },
      {
        id: 3,
        speaker: judge,
        role: "Judge",
        title: "Judge Transition to Lead Opponent",
      },
      {
        id: 4,
        speaker: isUserPro ? lead : { firstName: userName },
        role: "Leader of Opposition",
        title: "Leader of Opposition Speech",
      },
      {
        id: 5,
        speaker: judge,
        role: "Judge",
        title: "Judge Transition to Deputy PM",
      },
      {
        id: 6,
        speaker: isUserPro ? { firstName: userName } : deputy,
        role: "Deputy Prime Minister",
        title: "Deputy Prime Minister Speech",
      },
      {
        id: 7,
        speaker: judge,
        role: "Judge",
        title: "Judge Transition to Deputy LO",
      },
      {
        id: 8,
        speaker: isUserPro ? deputy : { firstName: userName },
        role: "Deputy Leader of Opposition",
        title: "Deputy Leader of Opposition Speech",
      },
      {
        id: 9,
        speaker: judge,
        role: "Judge",
        title: "Judge Transition to Affirmative Rebuttal",
      },
      {
        id: 10,
        speaker: isUserPro ? { firstName: userName } : whip,
        role: "Affirmative Rebuttal",
        title: "Affirmative Rebuttal Speech",
      },
      {
        id: 11,
        speaker: judge,
        role: "Judge",
        title: "Judge Transition to Opposition Whip",
      },
      {
        id: 12,
        speaker: isUserPro ? whip : { firstName: userName },
        role: "Opposition Whip",
        title: "Opposition Whip Speech",
      },
      {
        id: 13,
        speaker: judge,
        role: "Judge",
        title: "Judge Closing & Winner",
      },
    ]

    const turnIndex = _messages.length
    const currentStep =
      rolesSequence[turnIndex] || rolesSequence[rolesSequence.length - 1]
    const nextStep =
      turnIndex + 1 < rolesSequence.length ? rolesSequence[turnIndex + 1] : null
    const willNextBeUser = nextStep?.speaker?.firstName === userName

    let stepInstruction = `\nSTRICT INSTRUCTION FOR CURRENT REQUEST:\n`
    stepInstruction += `- You are performing STEP ${turnIndex + 1} of 13: "${currentStep.title}".\n`
    stepInstruction += `- YOU MUST PLAY THE ROLE OF: ${currentStep.speaker?.firstName || "AI"} in the capacity of ${currentStep.role}.\n`
    stepInstruction += `- set "isUsersTurn": ${willNextBeUser ? "true" : "false"}.\n`

    if (turnIndex >= 12) {
      stepInstruction += `- set "status": "COMPLETED".`
    } else {
      stepInstruction += `- set "status": "IN_PROGRESS".`
    }

    const basePrompt = getDebatePrompt(
      interaction.debate?.subject || "Debate",
      interaction.userSide || "Pending",
    )
    return `${basePrompt}\n${stepInstruction}`
  },
  getCoachPrompt: (params: CoachParams) => {
    return `You are an expert Debate Coach and Rhetoric Specialist. 
You are helping a debater named "${params.candidateName || "User"}" in a formal debate on the subject: "${params.subject || "the Subject"}".

YOUR TASK:
Write exactly what the debater should say next to build a compelling argument, respond to opponents, or summarize their position.

RULES FOR THE RESPONSE:
1. PERSUASIVE & FORMAL: Use strong logical structures, rhetorical devices, and an authoritative yet persuasive tone.
2. FIRST-PERSON ONLY: Write exclusively as the debater. 
3. SPOKEN STYLE: Use plain text only. No markdown.
4. CONTEXT-AWARE: Synthesize the current transcript and debate history.`
  },
  getInterviewerName: () => "Moderator",
  getModel: () => "luna",
  speakerTitle: "Moderator",
}
