import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { aiService } from "@/services/ai.services"
import { ChatBatchSchema } from "@/schemas/chat"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: sessionId } = await params
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const validation = ChatBatchSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.format() },
        { status: 400 },
      )
    }

    const { messages } = validation.data

    // Fetch the interaction session
    const interaction = await prisma.agentInteraction.findUnique({
      where: { id: sessionId },
      include: {
        interview: true,
        user: true,
      },
    })

    if (!interaction || !interaction.interview) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const jobTitle = interaction.interview.jobTitle
    const jobDescription = interaction.interview.description

    const coreMessages = (messages as { role: string; content: string }[]).map(
      (m) => ({
        role: m.role,
        content: m.content,
      }),
    )

    if (
      coreMessages.length > 0 &&
      coreMessages[coreMessages.length - 1].role === "assistant"
    ) {
      coreMessages.push({
        role: "user",
        content:
          "I am ready to answer the next question. Based on the interview context above, help me formulate a professional and impactful response.",
      })
    }

    const systemPrompt = `
You are an expert Interview Coach. 
The user is in a ${interaction.interview.type} interview for the position of: "${jobTitle}"
Job Description: ${jobDescription}

TASK:
Provide a concise, professional, and high-impact response (max 1000 characters) for the user to say. 
The response should be tailored to the interviewer's last question and highlight the user's potential.
Keep it natural and direct.

FORMAT:
Return ONLY the text of the speech. 
Do not include any introductory notes or coaching advice.
Just the raw response content.
`

    const text = await aiService.generateText([
      { role: "system", content: systemPrompt },
      ...coreMessages,
    ])

    return NextResponse.json({ suggestion: text.trim() })
  } catch (error: unknown) {
    console.error("Error in suggestion API:", error)
    return NextResponse.json(
      { error: "Failed to generate suggestion" },
      { status: 500 },
    )
  }
}
