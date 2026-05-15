import { z } from "zod"

/**
 * Schema for AI coaching stream requests.
 */
export const CoachStreamSchema = z.object({
  messages: z.array(z.any()),
  candidateName: z.string().optional(),
  interviewerName: z.string().optional(),
  interviewType: z.string().optional(),
  jobTitle: z.string().optional(),
  jobDescription: z.string().optional(),
  currentTranscript: z.string().optional(),
  sessionType: z.string().optional(),
  personaInstructions: z.string().optional(),
})
