import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { s3Service } from "@/services/s3.services"
import prisma from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { aiService } from "@/services/ai.services"
import { AiResponseSchema } from "@/schemas/chat"
import { getAiPersonaPrompt } from "@/features/ai_persona/prompts"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: sessionId } = await params
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { messages, duration, code, audioUrl, audioPublicId } =
      await req.json()

    const agentSession = await prisma.agentInteraction.findUnique({
      where: { id: sessionId, userId: session.user.id },
      include: {
        aiPersona: true,
        user: true,
      },
    })

    if (!agentSession || !agentSession.aiPersona) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const persona = agentSession.aiPersona
    const { getCharacter } = await import("@/lib/characters")
    const character = persona.characterId
      ? getCharacter(persona.characterId)
      : null
    const model = character?.model || "luna"

    const systemPrompt = getAiPersonaPrompt(persona.name, persona.instruction)

    // Normalize messages
    const augmentedMessages = (
      messages as {
        role: string
        parts?: string | { type: string; text?: string }[]
        content?: string
        code?: string
      }[]
    ).map((m) => {
      let content = ""
      if (typeof m.parts === "string") {
        content = m.parts
      } else if (Array.isArray(m.parts)) {
        content = (m.parts as { type: string; text?: string }[])
          .filter((p) => p.type === "text")
          .map((p) => p.text)
          .join("\n")
      } else if (m.content) {
        content = m.content
      }
      return {
        role: m.role,
        content: m.code
          ? `${content}\n\n[SUBMITTED CODE]:\n${m.code}`
          : content,
      }
    })

    const finalMessages = [
      { role: "system", content: systemPrompt },
      ...(augmentedMessages.length === 0
        ? [
            {
              role: "user",
              content: `Please introduce yourself as ${persona.name} and start the session.`,
            },
          ]
        : augmentedMessages),
    ]

    const aiData = (await aiService.generateObject(
      finalMessages,
      AiResponseSchema,
    )) as z.infer<typeof AiResponseSchema>

    const textPart = aiData.parts.find(
      (p: { type: string }) => p.type === "text",
    ) as
      | {
          type: string
          text: string
          audio?: { url: string | null; path: string | null }
          speakerName?: string
          speakerTitle?: string
          isUsersTurn?: boolean
        }
      | undefined
    let audioData = null
    if (textPart) {
      try {
        audioData = await aiService.textToSpeech(textPart.text, model)
        const signedUrl = await s3Service.getSignedDownloadUrl(audioData.path)
        textPart.audio = {
          url: signedUrl,
          path: audioData.path,
        }
        textPart.speakerName = textPart.speakerName || persona.name
        textPart.speakerTitle = textPart.speakerTitle || "AI Persona"
      } catch (err) {
        console.error("TTS Error:", err)
      }
    }

    // Save user message if provided
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1]
      if (lastMsg.role === "user") {
        await prisma.message.create({
          data: {
            interactionId: sessionId,
            role: "user",
            parts: [
              {
                type: "text",
                text:
                  typeof (lastMsg.parts || lastMsg.content) === "string"
                    ? lastMsg.parts || lastMsg.content
                    : Array.isArray(lastMsg.parts)
                      ? lastMsg.parts
                          .filter(
                            (p: { type: string; text?: string }) =>
                              p.type === "text",
                          )
                          .map((p: { text?: string }) => p.text)
                          .join("\n")
                      : "",
                speakerName: agentSession.user?.name || "User",
                speakerTitle: "User",
                isUsersTurn: false,
                audio: {
                  url: audioUrl || null,
                  path: audioPublicId || null,
                },
              },
              ...(code
                ? [{ type: "tool", name: "open_editor", parameters: { code } }]
                : []),
            ],
          },
        })
      }
    }

    // Save assistant message
    await prisma.message.create({
      data: {
        interactionId: sessionId,
        role: "assistant",
        parts: aiData.parts as Prisma.InputJsonValue,
      },
    })

    // Update session
    await prisma.agentInteraction.update({
      where: { id: sessionId },
      data: {
        duration: duration || undefined,
        status: aiData.status,
      },
    })

    return NextResponse.json({
      parts: aiData.parts,
      status: aiData.status,
      text: textPart?.text,
      audioUrl: textPart?.audio?.url,
      isUsersTurn: textPart?.isUsersTurn,
    })
  } catch (error) {
    console.error("Error in AI Persona chat fallback:", error)
    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 },
    )
  }
}
