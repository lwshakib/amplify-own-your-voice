import { validateSession } from "@/lib/auth-utils"
import { NextResponse } from "next/server"
import { aiService } from "@/services/ai.services"
import {
  PersonaInfoSchema,
  GeneratePersonaInfoInputSchema,
} from "@/schemas/ai-persona"

export async function POST(req: Request) {
  const { errorResponse } = await validateSession()
  if (errorResponse) return errorResponse

  const body = await req.json()
  const validation = GeneratePersonaInfoInputSchema.safeParse(body)

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.format() },
      { status: 400 },
    )
  }

  const {
    description,
    goal,
    name: existingName,
    existingInstructions,
  } = validation.data
  const finalGoal = goal || description

  const isRefining = !!existingInstructions

  try {
    const { getPersonaBuilderPrompt } =
      await import("@/features/ai_persona/builder-prompts")
    const systemPrompt = getPersonaBuilderPrompt(isRefining, {
      name: existingName,
      instructions: existingInstructions,
      goal,
    })

    const generatedInfo = await aiService.generateObject({
      messages: [
        {
          role: "system",
          content:
            systemPrompt + "\n\nYou MUST return the JSON structure specified.",
        },
        {
          role: "user",
          content: isRefining
            ? `Refinement Goal: "${goal}"`
            : `User's Goal: "${finalGoal}"`,
        },
      ],
      outputSchema: PersonaInfoSchema,
      signal: req.signal,
    })

    return NextResponse.json({
      name: generatedInfo.name,
      instruction: generatedInfo.instructions,
      characterId: generatedInfo.character_id,
      avatarUrl: null,
    })
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return new Response(null, { status: 204 })
    }
    console.error("Error generating agent info:", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}
