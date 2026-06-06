import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { streamText } from "@/llm/streamText"
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

    // Fetch the debate session and motion
    const interaction = await prisma.agentInteraction.findUnique({
      where: { id: sessionId },
      include: {
        debate: true,
        user: true,
      },
    })

    if (!interaction || !interaction.debate) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const motion = interaction.debate.subject
    const extraInfo = interaction.debate.content || "No extra context provided."
    const userSide = interaction.userSide
    const userName = interaction.user?.name || "User"

    const coreMessages = (
      messages as {
        role: string
        content?: string
        parts?: { type: string; text?: string }[]
        speakerName?: string
        speakerTitle?: string
      }[]
    ).map((m) => {
      const parts = m.parts || m.content
      const text = Array.isArray(parts)
        ? (parts as { type: string; text: string }[])
            .filter((p) => p.type === "text")
            .map((p) => p.text)
            .join("\n")
        : parts
      return {
        role: m.role,
        content: `${m.speakerName} (${m.speakerTitle}): ${text}`,
      }
    })

    // Determine whose turn it is
    const turnCount = coreMessages.length
    const isFirstSpeaker = turnCount === 1 // Only Judge spoke
    const isUserPro = interaction.userSide === "PRO"

    // Simple turn mapping for 3v3 style (Judge -> PM -> LO -> Deputy PM -> Deputy LO -> Rebuttal -> Whip -> Judge)
    const roles = isUserPro
      ? ["Prime Minister", "Deputy Prime Minister", "Affirmative Rebuttal"]
      : [
          "Leader of Opposition",
          "Deputy Leader of Opposition",
          "Opposition Whip",
        ]

    // We assume the user is asking for a suggestion for the NEXT speaker on their team in the sequence.
    // This is a simplification but helps the AI focus.
    const currentUserRole = isFirstSpeaker
      ? roles[0]
      : "the current active debater"

    if (
      coreMessages.length > 0 &&
      coreMessages[coreMessages.length - 1].role === "assistant"
    ) {
      coreMessages.push({
        role: "user",
        content: `I am now taking the floor as the ${currentUserRole}. Based on the debate above, help me formulate a powerful speech for my turn.`,
      })
    }

    const systemPrompt = `
You are an expert Debate Coach. 
The user is participating in a debate on the motion: "${motion}"
Context: ${extraInfo}
User's Team: ${userSide === "PRO" ? "AFFIRMATIVE (Government)" : "NEGATIVE (Opposition)"}

TASK:
You are currently coaching the ${userName} who is playing the role of ${currentUserRole}.
Provide a concise, high-impact speech (max 1000 characters) for the user to read. 

If this is the beginning of the debate (the user is the Prime Minister starting the first turn), provide a strong opening statement that defines the motion and sets the case.
If the other side has already spoken, focus on rebutting their points and reinforcing the user's team line.

Address the Judge (${interaction.debate.judgeId}) and the audience formally.

FORMAT:
Return ONLY the text of the speech. 
CRITICAL: Do not include the speaker's name, title, or any prefix. 
Do not include any introductory notes, instructions, or coaching advice like "Here is your speech:".
Just the raw speech content.
`

    const stream = await streamText([
      { role: "system", content: systemPrompt },
      ...coreMessages,
    ])

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    })
  } catch (error) {
    console.error("Error in suggestion API:", error)
    return NextResponse.json(
      { error: "Failed to generate suggestion" },
      { status: 500 },
    )
  }
}
