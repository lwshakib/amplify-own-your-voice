import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { validateSession } from "@/lib/auth-utils"
import { generateObject } from "@/llm/generateObject"
import { EvaluationSchema } from "@/schemas/common"
import { Prisma } from "@/generated/prisma/client"
import { z } from "zod"

const MessageInputSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string(),
  speakerName: z.string(),
  speakerTitle: z.string(),
  status: z.enum(["IN_PROGRESS", "COMPLETED"]).optional(),
  duration: z.number().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { session, errorResponse } = await validateSession()
    if (errorResponse) return errorResponse

    const body = await req.json()
    const validation = MessageInputSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.format() },
        { status: 400 },
      )
    }

    const { role, text, speakerName, speakerTitle, status, duration } =
      validation.data

    const interaction = await prisma.agentInteraction.findUnique({
      where: {
        id: id,
        userId: session.user.id,
      },
      include: {
        interview: true,
      },
    })

    if (!interaction) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const message = await prisma.message.create({
      data: {
        interactionId: id,
        role,
        parts: [
          {
            type: "text",
            text,
            speakerName,
            speakerTitle,
            isUsersTurn: role === "user" ? false : true,
            audio: {
              url: null,
              path: null,
            },
          },
        ],
      },
    })

    // Update session status and duration if provided
    await prisma.agentInteraction.update({
      where: { id },
      data: {
        status: status || undefined,
        duration: duration || undefined,
      },
    })

    // If it's a user message, run asynchronous background evaluation
    if (role === "user") {
      // Evaluate out-of-band so we don't block the WebSocket client
      runBackgroundEvaluation(id, message.id, text, interaction.interview)
    }

    return NextResponse.json({ success: true, messageId: message.id })
  } catch (error: any) {
    console.error("Error saving live API message:", error)
    return NextResponse.json(
      { error: error.message || "Failed to save message" },
      { status: 500 },
    )
  }
}

/**
 * Background evaluation task to analyze user's latest response and sync metrics.
 */
async function runBackgroundEvaluation(
  interactionId: string,
  messageId: string,
  userText: string,
  interview: any,
) {
  try {
    if (!interview) return

    // 1. Fetch conversation history
    const previousMessages = await prisma.message.findMany({
      where: { interactionId },
      orderBy: { createdAt: "asc" },
      take: 10,
    })

    const historyText = previousMessages
      .map((m) => {
        const parts = m.parts as any[]
        const textPart = parts?.find((p) => p.type === "text")
        return `${m.role === "user" ? "Candidate" : "Interviewer"}: ${textPart?.text || ""}`
      })
      .join("\n")

    // 2. Query LLM for evaluation
    const evaluationPrompt = `You are an expert Interview Coach.
Analyze the candidate's last answer during a job interview.
Return constructive feedback and scores from 0 to 100 for these metrics:
- correctness: Technical accuracy or understanding of standard practices.
- clarity: Fluency and articulateness of response.
- relevance: Direct alignment with the job title, details, and the question.
- detail: Depth and scope of explanation.
- efficiency: Directness and lack of fluff or filler.
- creativity: Problem-solving approach or unique insights.
- communication: Tone, vocabulary, and professionalism.
- problemSolving: Skill at handling scenario questions or difficulties.

CONTEXT:
Job Title: ${interview.jobTitle}
Job Description: ${interview.description}

CONVERSATION HISTORY:
${historyText}

CANDIDATE'S LAST ANSWER:
"${userText}"`

    const evaluationResult = await generateObject({
      messages: [
        {
          role: "system",
          content:
            evaluationPrompt +
            "\n\nYou MUST return the JSON structure containing feedback (string) and metrics (object).",
        },
        {
          role: "user",
          content: "Evaluate the candidate's last answer.",
        },
      ],
      outputSchema: EvaluationSchema,
    })

    if (evaluationResult) {
      // 3. Save feedback and metrics to the user message
      await prisma.message.update({
        where: { id: messageId },
        data: {
          feedback: evaluationResult.feedback,
          metrics: {
            create: {
              ...evaluationResult.metrics,
            },
          },
        },
      })

      // 4. Update session-wide average metrics
      const allUserMessages = await prisma.message.findMany({
        where: {
          interactionId,
          role: "user",
          metrics: { isNot: null },
        },
        include: { metrics: true },
      })

      if (allUserMessages.length > 0) {
        const metrics = [
          "correctness",
          "clarity",
          "relevance",
          "detail",
          "efficiency",
          "creativity",
          "communication",
          "problemSolving",
        ]
        const averages: Record<string, number> = {}
        metrics.forEach((metric) => {
          const sum = allUserMessages.reduce((acc, msg) => {
            const val = msg.metrics
              ? (msg.metrics[metric as keyof typeof msg.metrics] as number)
              : 0
            return acc + (val || 0)
          }, 0)
          averages[metric] = Math.round(sum / allUserMessages.length)
        })

        await prisma.agentInteraction.update({
          where: { id: interactionId },
          data: {
            metrics: {
              upsert: {
                create: { ...averages },
                update: { ...averages },
              },
            },
          },
        })
      }
    }
  } catch (error) {
    console.error("Background evaluation error:", error)
  }
}
