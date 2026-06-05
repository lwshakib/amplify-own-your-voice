import { getSignedDownloadUrl, deleteFile } from "@/lib/s3"
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

interface MessagePart {
  type: string
  audio?: {
    path?: string
    publicId?: string
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const authSession = await auth.api.getSession({
      headers: await headers(),
    })

    if (!authSession) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const interaction = await prisma.agentInteraction.findUnique({
      where: { id: id, userId: authSession.user.id },
      include: {
        interview: {
          select: {
            jobTitle: true,
            description: true,
            type: true,
            characterId: true,
          },
        },
        debate: true,
        aiPersona: true,
        metrics: true,
        messages: {
          orderBy: { createdAt: "asc" },
          include: { metrics: true },
        },
      },
    })

    if (!interaction) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // Map Enum to frontend-friendly type strings
    const typeMap = {
      INTERVIEW: "interview",
      DEBATE: "debate",
      AI_PERSONA: "ai-persona",
    }

    // Resolve paths to signed URLs for all messages
    const processedMessages = await Promise.all(
      (interaction.messages || []).map(async (msg) => {
        const parts = (msg.parts as unknown as MessagePart[]) || []
        const processedParts = await Promise.all(
          parts.map(async (part) => {
            if (part.audio?.path) {
              try {
                const signedUrl = await getSignedDownloadUrl(part.audio.path)
                return {
                  ...part,
                  audio: { ...part.audio, url: signedUrl },
                }
              } catch (err) {
                console.error(`Failed to sign URL for ${part.audio.path}:`, err)
              }
            }
            return part
          }),
        )
        return { ...msg, parts: processedParts }
      }),
    )

    // Also resolve Persona avatar if it exists
    let processedAiPersona = interaction.aiPersona
    if (processedAiPersona?.avatar) {
      const avatar = processedAiPersona.avatar as any
      if (avatar.path) {
        try {
          const signedUrl = await getSignedDownloadUrl(avatar.path)
          processedAiPersona = {
            ...processedAiPersona,
            avatar: { ...avatar, url: signedUrl },
          }
        } catch (err) {
          console.error(`Failed to sign Persona avatar URL:`, err)
        }
      }
    }

    return NextResponse.json({
      ...interaction,
      messages: processedMessages,
      aiPersona: processedAiPersona,
      type: typeMap[interaction.type] || interaction.type.toLowerCase(),
    })
  } catch (error: unknown) {
    console.error("Error fetching session:", error)
    return NextResponse.json(
      { error: "Failed to fetch session" },
      { status: 500 },
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const authSession = await auth.api.getSession({
      headers: await headers(),
    })

    if (!authSession) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 1. Fetch all messages to extract audio paths from parts
    const interactionMessages = await prisma.message.findMany({
      where: { interactionId: id },
    })

    const paths: string[] = []
    interactionMessages.forEach((msg) => {
      const parts = msg.parts as unknown as MessagePart[]
      if (Array.isArray(parts)) {
        parts.forEach((part) => {
          if (part.audio?.path) {
            paths.push(part.audio.path)
          }
        })
      }
    })

    for (const path of paths) {
      try {
        await deleteFile(path)
      } catch (err: unknown) {
        console.error(`Failed to delete S3 asset ${path}:`, err)
      }
    }

    // 3. Delete the session (cascade will handle messages if configured, but Prisma delete handles it)
    await prisma.agentInteraction.delete({
      where: { id: id, userId: authSession.user.id },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error("Error deleting session:", error)
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 },
    )
  }
}
