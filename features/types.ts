export interface AuthUser {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
}

export interface InterviewData {
  jobTitle: string
  description: string
  type: string
  characterId: string | null
}

export interface DebateData {
  id: string
  subject: string
  content: string | null
  judgeId: string | null
  opponentId: string | null
  opponentIds: string[]
}

export interface AiPersonaData {
  id: string
  name: string
  instruction: string
  characterId: string | null
}

export interface AgentInteraction {
  id: string
  type: string
  userSide?: string | null
  interview?: InterviewData | null
  debate?: DebateData | null
  aiPersona?: AiPersonaData | null
}

export interface CoachParams {
  candidateName?: string
  interviewerName?: string
  interviewType?: string
  jobTitle?: string
  jobDescription?: string
  currentTranscript?: string
  personaInstructions?: string
  subject?: string
}

export interface MessagePart {
  type: "text" | "tool"
  text?: string
  speakerName?: string
  speakerTitle?: string
  isUsersTurn?: boolean
  audio?: {
    path: string | null
    url: string | null
    publicId?: string | null
  }
  tool?: {
    name: string
    parameters: Record<string, unknown>
  }
  name?: string
  parameters?: Record<string, unknown>
}

export interface Message {
  id?: string
  role: string
  parts: MessagePart[]
  feedback?: string
  status?: string
}

export interface FeatureLogic {
  getPrompt: (
    interaction: AgentInteraction,
    user: AuthUser,
    messages: Message[],
  ) => string
  getCoachPrompt: (params: CoachParams) => string
  getInterviewerName: (interaction: AgentInteraction) => string
  getModel: (interaction: AgentInteraction) => string
  speakerTitle: string
}
