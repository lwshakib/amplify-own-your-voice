import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { CreateSessionSchema } from "@/schemas/session"

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const validation = CreateSessionSchema.safeParse(await req.json())

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.format() },
        { status: 400 },
      )
    }

    const { interviewId, debateId, aiPersonaId } = validation.data

    // Determine type and validate
    let interactionType: "INTERVIEW" | "DEBATE" | "AI_PERSONA" | null = null

    if (interviewId) interactionType = "INTERVIEW"
    else if (debateId) interactionType = "DEBATE"
    else if (aiPersonaId) interactionType = "AI_PERSONA"

    if (!interactionType) {
      return NextResponse.json(
        { error: "Entity ID is required" },
        { status: 400 },
      )
    }

    // Create a new interaction record
    const interaction = await prisma.agentInteraction.create({
      data: {
        type: interactionType,
        userId: session.user.id,
        interviewId,
        debateId,
        aiPersonaId,
        status: "IN_PROGRESS",
      },
    })

    return NextResponse.json(interaction)
  } catch (error: unknown) {
    console.error("Error creating interaction:", error)
    return NextResponse.json(
      { error: "Failed to create interaction" },
      { status: 500 },
    )
  }
}

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const interactions = await prisma.agentInteraction.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        interview: true,
        debate: true,
        aiPersona: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    // Map to the format the frontend expects (normalized)
    const typeMap: Record<string, string> = {
      INTERVIEW: "interview",
      DEBATE: "debate",
      AI_PERSONA: "ai-persona",
    }

    const normalizedSessions = interactions.map((interaction) => ({
      ...interaction,
      type: typeMap[interaction.type] || interaction.type.toLowerCase(),
    }))

    return NextResponse.json(normalizedSessions)
  } catch (error: unknown) {
    console.error("Error fetching interactions:", error)
    return NextResponse.json(
      { error: "Failed to fetch interactions" },
      { status: 500 },
    )
  }
}
