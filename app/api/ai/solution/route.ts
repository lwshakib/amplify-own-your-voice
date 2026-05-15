import { NextRequest, NextResponse } from "next/server"
import { aiService } from "@/services/ai.services"
import { z } from "zod"

const SolutionSchema = z.object({
  solution: z
    .string()
    .describe("The full code solution for the coding challenge."),
  explanation: z
    .string()
    .describe("A brief explanation of how the solution works."),
})

export async function POST(req: NextRequest) {
  try {
    const { title, description, language, currentCode } = await req.json()

    const systemPrompt = `You are an expert ${language} engineer. 
    A user is stuck on a coding challenge and needs a solution.
    
    CHALLENGE TITLE: ${title}
    CHALLENGE DESCRIPTION:
    ${description}
    
    CURRENT CODE:
    ${currentCode || "// Start coding here"}
    
    YOUR TASK:
    Provide the most efficient, clean, and well-commented solution for this challenge. 

    OUTPUT FORMAT (MUST BE VALID JSON):
    You MUST return a JSON object with EXACTLY these two keys:
    1. "solution": The complete code as a single string. 
    2. "explanation": A brief, high-level explanation (string).

    Return ONLY the solution and explanation in the specified JSON format.`

    const result = await aiService.generateObject({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content:
            "Generate the complete solution based on the challenge description above.",
        },
      ],
      outputSchema: SolutionSchema,
    })

    return NextResponse.json({
      solution: result.solution,
      explanation: result.explanation,
    })
  } catch (error) {
    console.error("AI Solution API error:", error)
    return NextResponse.json(
      { error: "Failed to generate solution" },
      { status: 500 },
    )
  }
}
