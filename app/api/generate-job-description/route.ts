import { NextRequest, NextResponse } from "next/server"
import { streamText } from "@/llm/streamText"
import { JobDescriptionGenerationSchema } from "@/schemas/generation"


const encoder = new TextEncoder()

/**
 * Converts an async generator into a standard Web ReadableStream.
 */
function iteratorToStream(iterator: AsyncGenerator<Uint8Array, void, unknown>) {
  return new ReadableStream({
    async pull(controller) {
      try {
        const { value, done } = await iterator.next()

        if (done) {
          controller.close()
        } else {
          controller.enqueue(value)
        }
      } catch (err) {
        console.error("Stream pipe error:", err)
        controller.error(err)
      }
    },
  })
}

/**
 * Async generator yielding data in SSE format.
 */
async function* makeIterator(jobTitle: string, type?: "TECHNICAL" | "GENERAL") {
  const isTechnical = type?.toUpperCase() === "TECHNICAL"
  const { getJobDescriptionSystemPrompt, getJobDescriptionUserPrompt } =
    await import("@/lib/interview/prompts")

  const messages = [
    { role: "system", content: getJobDescriptionSystemPrompt() },
    {
      role: "user",
      content: getJobDescriptionUserPrompt(jobTitle, isTechnical),
    },
  ]

  const readableStream = await streamText(messages)
  const reader = readableStream.getReader()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      yield value
    }
    // Yield terminal flag to notify EventSource to close
    yield encoder.encode("data: [DONE]\n\n")
  } finally {
    reader.releaseLock()
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const jobTitle = searchParams.get("jobTitle") || ""
    const type = searchParams.get("type") || undefined

    const validation = JobDescriptionGenerationSchema.safeParse({ jobTitle, type })

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.format() },
        { status: 400 },
      )
    }

    const iterator = makeIterator(validation.data.jobTitle, validation.data.type)
    const stream = iteratorToStream(iterator)

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error: unknown) {
    console.error("Generation error:", error)
    return NextResponse.json(
      { error: "Failed to generate job description" },
      { status: 500 },
    )
  }
}

