import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { CreateDebateSessionSchema } from "@/schemas/debate"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: debateId } = await params
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const json = await req.json().catch(() => ({}))
    const validation = CreateDebateSessionSchema.safeParse(json)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.format() },
        { status: 400 },
      )
    }

    const userSide = validation.data.userSide ?? null

    // Create a new debate session via AgentInteraction
    const interaction = await prisma.agentInteraction.create({
      data: {
        debateId,
        userId: session.user.id,
        type: "DEBATE",
        status: "IN_PROGRESS",
        userSide: userSide,
      },
    })

    return NextResponse.json(interaction)
  } catch (error: unknown) {
    console.error("Error creating debate session:", error)
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 },
    )
  }
}
