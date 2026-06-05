import { getSignedDownloadUrl } from "@/lib/s3"
import { validateSession } from "@/lib/auth-utils"
import { NextResponse } from "next/server"
import { GenerateAvatarSchema } from "@/schemas/ai-persona"
import { aiService } from "@/services/ai.services"
const MODEL_NAME = "FLUX.2 [klein] 9B"

export async function POST(req: Request) {
  const { errorResponse } = await validateSession()
  if (errorResponse) return errorResponse

  const body = await req.json()
  const validation = GenerateAvatarSchema.safeParse(body)

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.format() },
      { status: 400 },
    )
  }

  const { name, goal, instruction, customPrompt } = validation.data
  const effectiveGoal = goal || instruction || name

  try {
    const { getAvatarBuilderPrompt } =
      await import("@/features/ai_persona/builder-prompts")
    const visualSystemPrompt = getAvatarBuilderPrompt({
      name,
      goal: effectiveGoal,
      instruction,
      customPrompt,
    })

    const richVisualPrompt = await aiService.generateText([
      { role: "system", content: visualSystemPrompt },
      {
        role: "user",
        content: `Generate the visual prompt for the "${name}" persona.`,
      },
    ])

    const imageResult = await aiService.generateImage({
      prompt: `${richVisualPrompt} (clean composition, no text, avatar icon style)`,
      width: 512,
      height: 512,
    })

    if (!imageResult.success || !imageResult.path) {
      throw new Error(imageResult.error || "Image generation failed")
    }

    // Get a temporary signed URL for the frontend to display immediately
    const signedUrl = await getSignedDownloadUrl(imageResult.path)

    return NextResponse.json({
      path: imageResult.path,
      url: signedUrl,
    })
  } catch (error) {
    console.error("Error generating avatar:", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}
