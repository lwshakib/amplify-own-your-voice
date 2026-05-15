import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { validateSession } from "@/lib/auth-utils"
import { CHARACTERS } from "@/lib/characters"
import { CreateDebateSchema } from "@/schemas/debate-creation"

export async function POST(req: NextRequest) {
  try {
    const { session, errorResponse } = await validateSession()
    if (errorResponse) return errorResponse

    const body = await req.json()
    const validation = CreateDebateSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.format() },
        { status: 400 },
      )
    }

    const { subject, content, judgeId, opponentId, opponentIds } =
      validation.data

    // Selection Logic
    let selectedJudgeId = judgeId
    if (!selectedJudgeId) {
      const randomJudge =
        CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)]
      selectedJudgeId = randomJudge.id
    }

    const finalOpponentIds = Array.isArray(opponentIds)
      ? opponentIds
      : opponentId
        ? [opponentId]
        : []

    // Ensure we have 3 members for the opposition party
    while (finalOpponentIds.length < 3) {
      const remainingForOpponent = CHARACTERS.filter(
        (c) => c.id !== selectedJudgeId && !finalOpponentIds.includes(c.id),
      )
      if (remainingForOpponent.length === 0) break
      const randomOpponent =
        remainingForOpponent[
          Math.floor(Math.random() * remainingForOpponent.length)
        ]
      finalOpponentIds.push(randomOpponent.id)
    }

    const debate = await prisma.debate.create({
      data: {
        subject,
        content: content || null,
        judgeId: selectedJudgeId,
        opponentId: finalOpponentIds[0], // Primary/Lead
        opponentIds: finalOpponentIds, // Full Team
        userId: session.user.id,
      },
    })

    return NextResponse.json(debate)
  } catch (error: unknown) {
    console.error("Error creating debate:", error)
    return NextResponse.json(
      { error: "Failed to create debate" },
      { status: 500 },
    )
  }
}

export async function GET() {
  try {
    const { session, errorResponse } = await validateSession()
    if (errorResponse) return errorResponse

    const debates = await prisma.debate.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        interactions: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
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
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json(debates)
  } catch (error: unknown) {
    console.error("Error fetching debates:", error)
    return NextResponse.json(
      { error: "Failed to fetch debates" },
      { status: 500 },
    )
  }
}
