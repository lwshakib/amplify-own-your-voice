import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { RateMarketplaceItemSchema } from "@/schemas/marketplace"

// POST /api/marketplace/[id]/rate - Rate a marketplace item
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
    const validation = RateMarketplaceItemSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.format() },
        { status: 400 },
      )
    }

    const { value } = validation.data
    const userId = session.user.id

    const rating = await prisma.marketplaceRating.upsert({
      where: {
        userId_marketplaceItemId: {
          userId,
          marketplaceItemId,
        },
      },
      update: { value },
      create: {
        userId,
        marketplaceItemId,
        value,
      },
    })

    return NextResponse.json(rating)
  } catch (error) {
    console.error("Error rating marketplace item:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    )
  }
}
