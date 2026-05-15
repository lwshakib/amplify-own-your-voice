import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { UpdateMarketplaceItemSchema } from "@/schemas/marketplace"

// GET /api/marketplace/[id] - Get a single item
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    const item = await prisma.marketplaceItem.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            image: true,
          },
        },
        ratings: {
          include: {
            user: {
              select: { name: true, image: true },
            },
          },
        },
        reviews: {
          include: {
            user: {
              select: { name: true, image: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    })

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }

    let isInstalled = false
    if (session?.user?.id) {
      const userId = session.user.id
      if (item.type === "INTERVIEW") {
        const check = await prisma.interview.findFirst({
          where: { userId, installedFromId: id },
        })
        isInstalled = !!check
      } else if (item.type === "DEBATE") {
        const check = await prisma.debate.findFirst({
          where: { userId, installedFromId: id },
        })
        isInstalled = !!check
      } else if (item.type === "AI_PERSONA") {
        const check = await prisma.aiPersona.findFirst({
          where: { userId, installedFromId: id },
        })
        isInstalled = !!check
      }
    }

    return NextResponse.json({ ...item, isInstalled })
  } catch (error) {
    console.error("Error fetching marketplace item:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    )
  }
}

// DELETE /api/marketplace/[id] - Remove from marketplace
export async function DELETE(
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

    if (item.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await prisma.marketplaceItem.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting marketplace item:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    )
  }
}

// PATCH /api/marketplace/[id] - Update marketplace item
export async function PATCH(
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
    const body = await req.json()
    const validation = UpdateMarketplaceItemSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.format() },
        { status: 400 },
      )
    }

    const { name, description, content } = validation.data

    const item = await prisma.marketplaceItem.findUnique({
      where: { id },
    })

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }

    if (item.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const updatedItem = await prisma.marketplaceItem.update({
      where: { id },
      data: {
        name,
        description,
        content,
      },
    })

    return NextResponse.json(updatedItem)
  } catch (error) {
    console.error("Error updating marketplace item:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    )
  }
}
