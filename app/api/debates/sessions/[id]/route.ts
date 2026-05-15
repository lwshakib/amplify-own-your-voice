import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { UpdateSessionSchema } from "@/schemas/session"

export async function GET(
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

    const interaction = await prisma.agentInteraction.findUnique({
      where: {
        id: id,
        userId: session.user.id,
        type: "DEBATE",
      },
      include: {
        debate: true,
        messages: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    })

    if (!interaction) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    return NextResponse.json(interaction)
  } catch (error) {
    console.error("Error fetching debate session:", error)
    return NextResponse.json(
      { error: "Failed to fetch session" },
      { status: 500 },
    )
  }
}

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

    const json = await req.json()
    const validation = UpdateSessionSchema.safeParse(json)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.format() },
        { status: 400 },
      )
    }

    const updated = await prisma.agentInteraction.update({
      where: {
        id: id,
        userId: session.user.id,
      },
      data: validation.data,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating debate session:", error)
    return NextResponse.json(
      { error: "Failed to update session" },
      { status: 500 },
    )
  }
}
