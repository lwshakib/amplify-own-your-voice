import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

// POST /api/marketplace/[id]/uninstall - Uninstall from my list
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
    const userId = session.user.id

    const item = await prisma.marketplaceItem.findUnique({
      where: { id },
    })

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }

    if (item.type === "INTERVIEW") {
      await prisma.interview.deleteMany({
        where: { userId, installedFromId: id },
      })
    } else if (item.type === "DEBATE") {
      await prisma.debate.deleteMany({
        where: { userId, installedFromId: id },
      })
    } else if (item.type === "AI_PERSONA") {
      await prisma.aiPersona.deleteMany({
        where: { userId, installedFromId: id },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error uninstalling marketplace item:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    )
  }
}
