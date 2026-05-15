import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { UpdateDebateSchema } from "@/schemas/debate-creation"

export async function GET(
  _req: NextRequest,
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

    const debate = await prisma.debate.findUnique({
      where: {
        id: id,
        userId: session.user.id,
      },
      include: {
        installedFrom: {
          include: {
            user: {
              select: {
                name: true,
                image: true,
              },
            },
          },
        },
        _count: {
          select: {
            interactions: true,
          },
        },
      },
    })

    if (!debate) {
      return NextResponse.json({ error: "Debate not found" }, { status: 404 })
    }

    return NextResponse.json(debate)
  } catch (error: unknown) {
    console.error("Error fetching debate:", error)
    return NextResponse.json(
      { error: "Failed to fetch debate" },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _req: NextRequest,
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

    await prisma.debate.delete({
      where: {
        id: id,
        userId: session.user.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error("Error deleting debate:", error)
    return NextResponse.json(
      { error: "Failed to delete debate" },
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

    const body = await req.json()
    const validation = UpdateDebateSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.format() },
        { status: 400 },
      )
    }

    const { subject, content, judgeId, opponentIds } = validation.data

    const updatedDebate = await prisma.debate.update({
      where: {
        id: id,
        userId: session.user.id,
      },
      data: {
        subject,
        content,
        judgeId,
        opponentIds: opponentIds ? opponentIds : undefined,
        opponentId: opponentIds?.[0] ? opponentIds[0] : undefined,
      },
    })

    return NextResponse.json(updatedDebate)
  } catch (error: unknown) {
    console.error("Error updating debate:", error)
    return NextResponse.json(
      { error: "Failed to update debate" },
      { status: 500 },
    )
  }
}
