import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// GET /api/marketplace/recommended - Get top 3 rated marketplace items
export async function GET() {
  try {
    const items = await prisma.marketplaceItem.findMany({
      include: {
        user: {
          select: {
            name: true,
            image: true,
          },
        },
        ratings: true,
      },
      take: 10, // Fetch more to calculate averages reliably
    })

    // Calculate average rating for each item
    const itemsWithAverages = items.map((item) => {
      const avgRating =
        item.ratings.length > 0
          ? item.ratings.reduce((acc, curr) => acc + curr.value, 0) /
            item.ratings.length
          : 0
      return { ...item, avgRating }
    })

    // Sort by average rating descending and take top 3
    const top3 = itemsWithAverages
      .sort((a, b) => b.avgRating - a.avgRating)
      .slice(0, 3)

    return NextResponse.json(top3)
  } catch (error) {
    console.error("Error fetching recommended items:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    )
  }
}
