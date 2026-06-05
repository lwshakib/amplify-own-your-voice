import { ai } from "./client"
import { CHAT_MODEL_ID } from "./constants"
import { normalizeMessages, Message } from "./utils"

export interface StreamTextOptions {
  temperature?: number
  systemInstruction?: string
  onFinish?: (result: { content: string; reasoning?: string }) => Promise<void> | void
  abortSignal?: AbortSignal
}

export async function streamText(
  messages: Message[],
  options?: StreamTextOptions | AbortSignal,
): Promise<ReadableStream> {
  let actualOptions: StreamTextOptions = {}
  if (options) {
    if (options instanceof AbortSignal) {
      actualOptions = { abortSignal: options }
    } else {
      actualOptions = options
    }
  }

  const { contents, systemInstruction } = normalizeMessages(
    messages,
    actualOptions.systemInstruction,
  )

  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      let finalContent = ""
      let finalReasoning = ""

      try {
        const responseStream = await ai.models.generateContentStream({
          model: CHAT_MODEL_ID,
          contents,
          config: {
            temperature: actualOptions.temperature,
            systemInstruction: systemInstruction,
            abortSignal: actualOptions.abortSignal,
            thinkingConfig: {
              includeThoughts: true,
            },
          },
        })

        for await (const chunk of responseStream) {
          const parts = chunk.candidates?.[0]?.content?.parts || []
          for (const part of parts) {
            if (!part.text) continue

            if (part.thought) {
              finalReasoning += part.text
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "reasoning", content: part.text })}\n\n`,
                ),
              )
            } else {
              finalContent += part.text
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "text", content: part.text })}\n\n`,
                ),
              )
            }
          }
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError") {
          console.log("[llm/streamText] Stream aborted")
        } else {
          console.error("[llm/streamText] Stream error:", error)
          controller.error(error)
          return
        }
      } finally {
        if (actualOptions.onFinish) {
          try {
            await actualOptions.onFinish({
              content: finalContent,
              reasoning: finalReasoning || undefined,
            })
          } catch (finishError) {
            console.error("[llm/streamText] Error in onFinish:", finishError)
          }
        }
        controller.close()
      }
    },
  })
}
