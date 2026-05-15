import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { UpdateMessageSchema } from "@/schemas/chat"
import { MessagePart } from "@/features/types"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const validation = UpdateMessageSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.format() },
        { status: 400 },
      )
    }

    const { audioUrl, audioPath, audioPublicId } = validation.data

    // Find the message and verify ownership via interaction
    const message = await prisma.message.findUnique({
      where: { id },
      include: {
        interaction: true,
      },
    })

    if (!message || message.interaction?.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Message not found or unauthorized" },
        { status: 404 },
      )
    }

    // Update the text part within the JSON parts array
    const parts = message.parts as unknown as MessagePart[]
    const textPart = parts.find((p) => p.type === "text")

    if (textPart) {
      textPart.audio = {
        url: audioUrl || null,
        path: audioPath || null,
        publicId: audioPublicId || null,
      }
    }

    await prisma.message.update({
      where: { id },
      data: { parts: parts as unknown as Prisma.InputJsonValue },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error("Error updating message audio:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    )
  }
}
