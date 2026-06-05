import { getSignedDownloadUrl } from "@/lib/s3"
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import { validateSession } from "@/lib/auth-utils"
import { aiService } from "@/services/ai.services"
// import { getToolPrompt, toolCallsSchema } from "@/lib/tools/registry"
import { AiResponseSchema } from "@/schemas/chat"
import { getFeatureLogic } from "@/features/registry"
import { MessagePart } from "@/features/types"
import { z } from "zod"


interface ChatMessage {
  role: "user" | "assistant" | "system"
  parts?: string | MessagePart[]
  content?: string
  code?: string
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { session, errorResponse } = await validateSession()
    if (errorResponse) return errorResponse

    const { messages, code, duration, audioUrl, audioPath } =
      await req.json()

    const interaction = await prisma.agentInteraction.findUnique({
      where: {
        id: id,
        userId: session.user.id,
      },
      include: {
        interview: true,
        debate: true,
        aiPersona: true,
        user: true,
      },
    })

    if (!interaction) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const feature = getFeatureLogic(interaction.type)

    if (!feature) {
      return NextResponse.json(
        { error: "Interaction type not supported" },
        { status: 400 },
      )
    }

    // Build Messages correctly by normalizing the "parts" structure
    const augmentedMessages = (messages as ChatMessage[]).map((m) => {
      let textContent = ""
      if (typeof m.parts === "string") {
        textContent = m.parts
      } else if (Array.isArray(m.parts)) {
        textContent = (m.parts as MessagePart[])
          .filter((p) => p.type === "text")
          .map((p) => p.text)
          .join("\n")

        // Include code content if present in parts
        const codeTool = (m.parts as MessagePart[]).find(
          (p) =>
            p.type === "tool" &&
            (p.name === "open_editor" || p.name === "openCodeEditor"),
        )
        if (codeTool?.parameters?.code) {
          textContent += `\n\n[CODE SUBMISSION]:\n${codeTool.parameters.code}`
        }
      } else if (m.content) {
        textContent = m.content
      }

      return {
        role: m.role,
        content: m.code ? `${textContent}\n\n[CODE]:\n${m.code}` : textContent,
        parts: [{ type: "text" as const, text: textContent }],
      }
    })

    // Map Prisma interaction to feature-expected AgentInteraction type
    const normalizedInteraction = {
      id: interaction.id,
      type: interaction.type as string,
      userSide: interaction.userSide,
      interview: interaction.interview
        ? {
            jobTitle: interaction.interview.jobTitle,
            description: interaction.interview.description,
            type: interaction.interview.type,
            characterId: interaction.interview.characterId,
          }
        : null,
      debate: interaction.debate
        ? {
            id: interaction.debate.id,
            subject: interaction.debate.subject,
            content: interaction.debate.content,
            judgeId: interaction.debate.judgeId,
            opponentId: interaction.debate.opponentId,
            opponentIds: (interaction.debate.opponentIds as string[]) || [],
          }
        : null,
      aiPersona: interaction.aiPersona
        ? {
            id: interaction.aiPersona.id,
            name: interaction.aiPersona.name,
            instruction: interaction.aiPersona.instruction,
            characterId: interaction.aiPersona.characterId,
          }
        : null,
    }

    const systemPrompt = feature.getPrompt(
      normalizedInteraction,
      session.user as any,
      augmentedMessages as any,
    )
    const interviewerName = feature.getInterviewerName(normalizedInteraction)
    const model = feature.getModel(normalizedInteraction)
    const speakerTitle = feature.speakerTitle

    const finalMessages = [
      { role: "system" as const, content: systemPrompt },
      ...(augmentedMessages.length === 0
        ? [
            {
              role: "user" as const,
              content:
                "Please start the session by greeting the candidate/user and following your instructions.",
            },
          ]
        : augmentedMessages),
    ]

    const aiData = (await aiService.generateObject(
      finalMessages,
      AiResponseSchema,
    )) as z.infer<typeof AiResponseSchema>

    // Save user message if exists
    let userMsgId: string | null = null
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1]
      if (lastMsg.role === "user") {
        const userMsg = await prisma.message.create({
          data: {
            interactionId: id,
            role: "user",
            parts: [
              {
                type: "text",
                text:
                  typeof (lastMsg.parts || lastMsg.content) === "string"
                    ? lastMsg.parts || lastMsg.content
                    : Array.isArray(lastMsg.parts)
                      ? (lastMsg.parts as MessagePart[])
                          .filter((p: MessagePart) => p.type === "text")
                          .map((p: MessagePart) => p.text)
                          .join("\n")
                      : "",
                speakerName: session.user.name || "Candidate",
                speakerTitle: "Candidate",
                isUsersTurn: false,
                audio: {
                  path: audioPath || null,
                  url: audioUrl || null,
                },
              },
              ...(code
                ? [{ type: "tool", name: "open_editor", parameters: { code } }]
                : []),
            ],
          },
        })
        userMsgId = userMsg.id
      }
    }

    // Process AI Parts & Generate Speech
    const textPart = (aiData.parts as MessagePart[]).find(
      (p) => p.type === "text",
    )
    if (textPart) {
      try {
        const audioData = await aiService.textToSpeech(textPart.text || "", model)
        const signedUrl = await getSignedDownloadUrl(audioData.path)

        textPart.audio = {
          path: audioData.path,
          url: signedUrl,
        }
        textPart.speakerName = textPart.speakerName || interviewerName
        textPart.speakerTitle = textPart.speakerTitle || speakerTitle
      } catch (err: unknown) {
        console.error("TTS Error:", err)
      }
    }

    await prisma.message.create({
      data: {
        interactionId: id,
        role: "assistant",
        parts: aiData.parts as Prisma.InputJsonValue,
      },
    })

    // Update session
    await prisma.agentInteraction.update({
      where: { id },
      data: {
        duration: duration || undefined,
        status: aiData.status,
      },
    })

    // Update evaluation if present
    if (aiData.evaluation && userMsgId) {
      await prisma.message.update({
        where: { id: userMsgId },
        data: {
          feedback: aiData.evaluation.feedback,
          metrics: {
            upsert: {
              create: { ...aiData.evaluation.metrics },
              update: { ...aiData.evaluation.metrics },
            },
          },
        },
      })

      // Update session-wide average metrics
      const allUserMessages = await prisma.message.findMany({
        where: { interactionId: id, role: "user", metrics: { isNot: null } },
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
          where: { id },
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

    return NextResponse.json({
      parts: aiData.parts,
      status: aiData.status,
      evaluation: aiData.evaluation,
      userMessageId: userMsgId,
    })
  } catch (error: unknown) {
    console.error("Error in unified chat:", error)
    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 },
    )
  }
}
