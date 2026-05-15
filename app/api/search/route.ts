import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id
    const query = req.nextUrl.searchParams.get("q")

    if (!query) {
      return NextResponse.json({ results: [] })
    }

    // 1. Interviews (by title, description, or interviewer character name)
    const interviews = await prisma.interview.findMany({
      where: {
        userId,
        OR: [
          { jobTitle: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 5,
    })

    // 2. Debates (by subject, mission/content)
    const debates = await prisma.debate.findMany({
      where: {
        userId,
        OR: [
          { subject: { contains: query, mode: "insensitive" } },
          { content: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 5,
    })

    // 3. AI Personas (by name, instruction)
    const aiPersonas = await prisma.aiPersona.findMany({
      where: {
        userId,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { instruction: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 5,
    })

    // 4. Session Conversations (searching within messages)
    const interactionMatches = await prisma.message.findMany({
      where: {
        interaction: { userId },
        OR: [{ parts: { array_contains: { type: "text", text: query } } }],
      },
      include: {
        interaction: {
          include: {
            interview: true,
            debate: true,
            aiPersona: true,
          },
        },
      },
      take: 30,
      distinct: ["interactionId"],
    })

    const results = [
      ...interviews.map((i) => ({
        id: i.id,
        title: i.jobTitle,
        type: "Interview Template",
        url: `/interviews/${i.id}`,
        subtitle: i.description.substring(0, 60) + "...",
      })),
      ...debates.map((d) => ({
        id: d.id,
        title: d.subject,
        type: "Debate Template",
        url: `/debates/${d.id}`,
        subtitle: (d.content || "").substring(0, 60) + "...",
      })),
      ...aiPersonas.map((a) => ({
        id: a.id,
        title: a.name,
        type: "AI Persona",
        url: `/ai-personas/${a.id}`,
        subtitle: a.instruction.substring(0, 60) + "...",
      })),
      ...interactionMatches
        .map((m) => {
          const interaction = m.interaction
          if (!interaction) return null

          const title =
            interaction.type === "INTERVIEW" && interaction.interview
              ? `Session: ${interaction.interview.jobTitle}`
              : interaction.type === "DEBATE" && interaction.debate
                ? `Session: ${interaction.debate.subject}`
                : interaction.type === "AI_PERSONA" && interaction.aiPersona
                  ? `Session: ${interaction.aiPersona.name}`
                  : "Session"

          const type =
            interaction.type === "INTERVIEW"
              ? "Interview Session"
              : interaction.type === "DEBATE"
                ? "Debate Session"
                : interaction.type === "AI_PERSONA"
                  ? "AI Persona Session"
                  : "Session"

          const url = `/sessions/${interaction.id}/run`

          return {
            id: interaction.id,
            title,
            type,
            url,
            subtitle: `Match: "${(Array.isArray(m.parts)
              ? (m.parts as { type: string; text: string }[])
                  .filter((p) => p.type === "text")
                  .map((p) => p.text)
                  .join("\n")
              : (m.parts as string)
            ).substring(0, 40)}..."`,
          }
        })
        .filter(Boolean),
    ]

    return NextResponse.json({ results })
  } catch (error: unknown) {
    console.error("Search error:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    )
  }
}
