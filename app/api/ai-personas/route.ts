import { s3Service } from "@/services/s3.services"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { CreatePersonaSchema } from "@/schemas/ai-persona"

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const agents = await prisma.aiPersona.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      interactions: {
        take: 1,
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
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

  const enrichedAgents = await Promise.all(
    agents.map(async (agent) => {
      const avatar = agent.avatar as {
        url?: string
        path?: string
        publicId?: string
      } | null
      if (avatar?.path) {
        try {
          avatar.url = await s3Service.getSignedDownloadUrl(avatar.path)
        } catch (err) {
          console.error(`Failed to sign URL for agent ${agent.id}:`, err)
        }
      }
      return agent
    }),
  )

  return NextResponse.json(enrichedAgents)
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const validation = CreatePersonaSchema.safeParse(await req.json())

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.format() },
      { status: 400 },
    )
  }

  const { name, instruction, characterId, avatar } = validation.data

  const agent = await prisma.aiPersona.create({
    data: {
      name,
      instruction,
      characterId,
      avatar: avatar || undefined,
      userId: session.user.id,
    },
  })

  return NextResponse.json(agent)
}
