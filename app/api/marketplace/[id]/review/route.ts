import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { ReviewMarketplaceItemSchema } from "@/schemas/marketplace"

// POST /api/marketplace/[id]/review - Review a marketplace item
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

    const { id: marketplaceItemId } = await params
    const body = await req.json()
    const validation = ReviewMarketplaceItemSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.format() },
        { status: 400 },
      )
    }

    const { content } = validation.data
    const userId = session.user.id

    const review = await prisma.marketplaceReview.upsert({
      where: {
        userId_marketplaceItemId: {
          userId,
          marketplaceItemId,
        },
      },
      update: { content },
      create: {
        userId,
        marketplaceItemId,
        content,
      },
    })

    return NextResponse.json(review)
  } catch (error) {
    console.error("Error reviewing marketplace item:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    )
  }
}
