import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { validateSession } from "@/lib/auth-utils"
import { CHARACTERS } from "@/lib/characters"
import { CreateInterviewSchema } from "@/schemas/interview"

export async function POST(req: NextRequest) {
  try {
    const { session, errorResponse } = await validateSession()
    if (errorResponse) return errorResponse

    const body = await req.json()
    const validation = CreateInterviewSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.format() },
        { status: 400 },
      )
    }

    const { jobTitle, description, characterId, type } = validation.data

    // Auto Selection if not provided
    let finalCharacterId = characterId
    if (!finalCharacterId) {
      const randomCharacter =
        CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)]
      finalCharacterId = randomCharacter.id
    }

    const interview = await prisma.interview.create({
      data: {
        jobTitle,
        description,
        type: type || "TECHNICAL",
        characterId: finalCharacterId,
        userId: session.user.id,
      },
    })

    return NextResponse.json(interview)
  } catch (error: unknown) {
    console.error("Error creating interview:", error)
    return NextResponse.json(
      { error: "Failed to create interview" },
      { status: 500 },
    )
  }
}

export async function GET() {
  try {
    const { session, errorResponse } = await validateSession()
    if (errorResponse) return errorResponse

    const interviews = await prisma.interview.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        interactions: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
        user: {
          select: {
            name: true,
            image: true,
          },
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
    })

    return NextResponse.json(interviews)
  } catch (error: unknown) {
    console.error("Error fetching interviews:", error)
    return NextResponse.json(
      { error: "Failed to fetch interviews" },
      { status: 500 },
    )
  }
}
