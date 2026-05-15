import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

// POST /api/marketplace/[id]/install - Install into my list
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const item = await prisma.marketplaceItem.findUnique({
      where: { id },
    })

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }

    const content = item.content as {
      jobTitle?: string
      description?: string
      type?: string
      characterId?: string
      subject?: string
      content?: string | null
      judgeId?: string
      opponentId?: string
      name?: string
      instruction?: string
    }
    const userId = session.user.id

    if (item.type === "INTERVIEW") {
      const existing = await prisma.interview.findFirst({
        where: { userId, installedFromId: id },
      })
      if (existing)
        return NextResponse.json({ success: true, alreadyInstalled: true })

      await prisma.interview.create({
        data: {
          jobTitle: content.jobTitle || "Untitled",
          description: content.description || "",
          type: (content.type as "TECHNICAL" | "GENERAL") || "TECHNICAL",
          characterId: content.characterId || "sarah",
          userId,
          installedFromId: id,
        },
      })
    } else if (item.type === "DEBATE") {
      const existing = await prisma.debate.findFirst({
        where: { userId, installedFromId: id },
      })
      if (existing)
        return NextResponse.json({ success: true, alreadyInstalled: true })

      await prisma.debate.create({
        data: {
          subject: content.subject || "Untitled",
          content: content.content || null,
          judgeId: content.judgeId || "ethan",
          opponentId: content.opponentId || "sophia",
          userId,
          installedFromId: id,
        },
      })
    } else if (item.type === "AI_PERSONA") {
      const existing = await prisma.aiPersona.findFirst({
        where: { userId, installedFromId: id },
      })
      if (existing)
        return NextResponse.json({ success: true, alreadyInstalled: true })

      await prisma.aiPersona.create({
        data: {
          name: content.name || "Untitled",
          instruction: content.instruction || "",
          characterId: content.characterId || "sarah",
          userId,
          installedFromId: id,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error installing marketplace item:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    )
  }
}
