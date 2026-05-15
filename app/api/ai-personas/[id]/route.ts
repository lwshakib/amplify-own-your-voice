import { Prisma } from "@/generated/prisma/client"
import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { UpdatePersonaSchema } from "@/schemas/ai-persona"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const { id } = await params

  const agent = await prisma.aiPersona.findUnique({
    where: {
      id,
      userId: session.user.id,
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
    },
  })

  if (!agent) {
    return new NextResponse("Not Found", { status: 404 })
  }

  return NextResponse.json(agent)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const { id } = await params

  try {
    await prisma.aiPersona.delete({
      where: {
        id,
        userId: session.user.id,
      },
    })
    return new NextResponse(null, { status: 204 })
  } catch (error: unknown) {
    console.error("Error deleting custom agent:", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const validation = UpdatePersonaSchema.safeParse(body)

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.format() },
      { status: 400 },
    )
  }

  const { name, instruction, characterId, avatar } = validation.data

  try {
    const agent = await prisma.aiPersona.update({
      where: {
        id,
        userId: session.user.id,
      },
      data: {
        name,
        instruction,
        characterId,
        avatar: avatar === null ? Prisma.JsonNull : avatar,
      },
    })
    return NextResponse.json(agent)
  } catch (error: unknown) {
    console.error("Error updating AI persona:", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}
