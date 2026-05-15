import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { validateSession } from "@/lib/auth-utils"
import { UpdateInterviewSchema } from "@/schemas/interview"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { session, errorResponse } = await validateSession()
    if (errorResponse) return errorResponse

    const interview = await prisma.interview.findUnique({
      where: {
        id: id,
        userId: session.user.id,
      },
    })

    if (!interview) {
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 },
      )
    }

    return NextResponse.json(interview)
  } catch (error: unknown) {
    console.error("Error fetching interview:", error)
    return NextResponse.json(
      { error: "Failed to fetch interview" },
      { status: 500 },
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { session, errorResponse } = await validateSession()
    if (errorResponse) return errorResponse

    const body = await req.json()
    const validation = UpdateInterviewSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.format() },
        { status: 400 },
      )
    }

    const { jobTitle, description, type, characterId } = validation.data

    const updatedInterview = await prisma.interview.update({
      where: {
        id: id,
        userId: session.user.id,
      },
      data: {
        jobTitle,
        description,
        type,
        characterId,
      },
    })

    return NextResponse.json(updatedInterview)
  } catch (error: unknown) {
    console.error("Error updating interview:", error)
    return NextResponse.json(
      { error: "Failed to update interview" },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { session, errorResponse } = await validateSession()
    if (errorResponse) return errorResponse

    await prisma.interview.delete({
      where: {
        id: id,
        userId: session.user.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error("Error deleting interview:", error)
    return NextResponse.json(
      { error: "Failed to delete interview" },
      { status: 500 },
    )
  }
}
