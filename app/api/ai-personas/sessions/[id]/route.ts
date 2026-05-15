import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function GET(
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

  const agentSession = await prisma.agentInteraction.findUnique({
    where: {
      id,
      userId: session.user.id,
    },
    include: {
      aiPersona: true,
      messages: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  })

  if (!agentSession) {
    return new NextResponse("Not Found", { status: 404 })
  }

  return NextResponse.json(agentSession)
}
