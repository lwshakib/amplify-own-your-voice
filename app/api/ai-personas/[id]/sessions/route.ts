import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const { id: agentId } = await params

  const agent = await prisma.aiPersona.findUnique({
    where: {
      id: agentId,
      userId: session.user.id,
    },
  })

  if (!agent) {
    return new NextResponse("Agent not found", { status: 404 })
  }

  const agentSession = await prisma.agentInteraction.create({
    data: {
      type: "AI_PERSONA",
      aiPersonaId: agentId,
      userId: session.user.id,
    },
  })

  return NextResponse.json(agentSession)
}
