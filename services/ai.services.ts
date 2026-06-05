import * as env from "@/lib/env"
import { CHAT_MODEL_ID, IMAGE_MODEL_ID, TTS_MODEL_ID } from "@/lib/constants"
import { uploadAsset } from "@/lib/s3"
import {
  StreamTextOptions,
  GenerateImageOptions,
  GenerateImageResult,
  GenerateAudioOptions,
  GenerateAudioResult,
} from "@/types/ai"

/**
 * AIService Class
 * Centralizes all AI-related operations via Cloudflare AI Gateway.
 * Lean implementation focusing on core Text, Image, and Audio models.
 */
export class AIService {
  private apiKey: string
  private gatewayUrl: string

  constructor() {
    this.apiKey = env.CLOUDFLARE_AI_GATEWAY_API_KEY!
    this.gatewayUrl = env.CLOUDFLARE_AI_GATEWAY_ENDPOINT!

    if (!this.apiKey || !this.gatewayUrl) {
      throw new Error(
        "AIService Configuration error: CLOUDFLARE_AI_GATEWAY_API_KEY and CLOUDFLARE_AI_GATEWAY_ENDPOINT must be defined.",
      )
    }
  }

  /**
   * SSE Text Streaming with support for Reasoning content.
   */
  async streamText(
    messages: { role: string; content: string }[],
    options?: StreamTextOptions,
  ): Promise<ReadableStream> {
    const { onFinish, abortSignal } = options || {}

    const response = await fetch(this.gatewayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: CHAT_MODEL_ID,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        stream: true,
      }),
      signal: abortSignal,
    })

    if (!response.ok) {
      throw new Error(`AI Gateway error: ${await response.text()}`)
    }

    const reader = response.body?.getReader()
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    return new ReadableStream({
      async start(controller) {
        if (!reader) {
          controller.close()
          return
        }

        let finalContent = ""
        let finalReasoning = ""

        try {
          let lineBuffer = ""
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            lineBuffer += decoder.decode(value, { stream: true })
            const lines = lineBuffer.split("\n")
            lineBuffer = lines.pop() || ""

            for (const line of lines) {
              const trimmed = line.trim()
              if (trimmed.startsWith("data: ") && trimmed !== "data: [DONE]") {
                try {
                  const data = JSON.parse(trimmed.slice(6))
                  const delta = data.choices?.[0]?.delta

                  if (delta?.reasoning_content) {
                    finalReasoning += delta.reasoning_content
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({ type: "reasoning", content: delta.reasoning_content })}\n\n`,
                      ),
                    )
                  }

                  if (delta?.content) {
                    finalContent += delta.content
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({ type: "text", content: delta.content })}\n\n`,
                      ),
                    )
                  }
                } catch (e) {
                  console.error("Error parsing stream chunk:", e)
                }
              }
            }
          }
        } catch (error: unknown) {
          if ((error as Error).name === "AbortError") {
            console.log("[AIService Stream] Aborted")
          } else {
            controller.error(error)
          }
        } finally {
          if (onFinish) {
            await onFinish({ content: finalContent, reasoning: finalReasoning })
          }
          reader.releaseLock()
          controller.close()
        }
      },
    })
  }

  /**
   * Non-streaming Text Generation.
   */
  async generateText(
    messages: { role: string; content: string }[],
    options?: { temperature?: number; max_tokens?: number },
  ): Promise<string> {
    const { temperature, max_tokens } = options || {}

    const response = await fetch(this.gatewayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: CHAT_MODEL_ID,
        messages,
        temperature,
        max_tokens,
        stream: false,
      }),
    })

    if (!response.ok) {
      throw new Error(`AI Gateway error: ${await response.text()}`)
    }

    const result = await response.json()
    return result.choices?.[0]?.message?.content || ""
  }

  /**
   * Structured JSON Generation with sanitization.
   */
  async generateObject<T>(
    messages: { role: string; content: string }[],
    outputSchema: any,
  ): Promise<T> {
    const response = await fetch(this.gatewayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: CHAT_MODEL_ID,
        messages,
        response_format: { type: "json_object" },
      }),
    })

    if (!response.ok) {
      throw new Error(`AI Gateway error: ${await response.text()}`)
    }

    const result = await response.json()
    const content = result.choices?.[0]?.message?.content

    if (!content) {
      throw new Error("Failed to generate object: No content in response.")
    }

    try {
      const cleanContent = this._sanitizeJSON(content)
      return JSON.parse(cleanContent)
    } catch (e) {
      console.error("[AIService] JSON Parse Error. Content:", content)
      throw new Error(
        `Model returned invalid JSON: ${content.slice(0, 100)}...`,
      )
    }
  }

  /**
   * Image Generation (Flux.2 Klein 9B) with Base64 support and S3 persistence.
   */
  async generateImage(
    options: GenerateImageOptions,
  ): Promise<GenerateImageResult> {
    const {
      prompt,
      width = 1024,
      height = 1024,
      steps = 25,
      images = [],
      guidance,
      seed,
    } = options

    try {
      const base64Images = await Promise.all(
        images.map(async (img) => await this._toBase64(img)),
      )

      const payload: any = {
        model: IMAGE_MODEL_ID,
        prompt,
        width: Math.min(width, 1024),
        height: Math.min(height, 1024),
        num_inference_steps: Math.min(steps, 50),
        seed,
        guidance,
      }

      if (base64Images.length > 0) {
        payload.images = base64Images
      }

      const response = await fetch(this.gatewayUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`AI Gateway Error: ${await response.text()}`)
      }

      const result = await response.json()
      if (!result.image) {
        throw new Error("No image returned in response")
      }

      const buffer = Buffer.from(result.image, "base64")
      const upload = await uploadAsset({
        buffer,
        folder: "avatars",
        extension: "png",
        contentType: "image/png",
      })

      return {
        success: true,
        path: upload.path,
        prompt,
        width,
        height,
        model: IMAGE_MODEL_ID,
      }
    } catch (error) {
      console.error("[AIService generateImage] Error:", error)
      return {
        success: false,
        error: String(error),
        prompt,
        model: IMAGE_MODEL_ID,
      }
    }
  }

  /**
   * Audio Generation (Deepgram Aura-2) with S3 persistence.
   */
  async generateAudio(
    options: GenerateAudioOptions,
  ): Promise<GenerateAudioResult> {
    const { text, voice = "luna" } = options

    try {
      const response = await fetch(this.gatewayUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: TTS_MODEL_ID,
          text,
          speaker: voice,
        }),
      })

      if (!response.ok) {
        throw new Error(`AI Gateway Error: ${await response.text()}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      return { success: true, buffer, text }
    } catch (error) {
      console.error("[AIService generateAudio] Error:", error)
      return { success: false, error: String(error), text }
    }
  }

  /**
   * Helper to resolve audio and upload to S3 (Standardizing method name for existing calls).
   */
  async textToSpeech(
    text: string,
    voice: string = "luna",
  ): Promise<{ path: string }> {
    const result = await this.generateAudio({ text, voice })
    if (!result.success || !result.buffer) {
      throw new Error(result.error || "Audio generation failed")
    }

    return await uploadAsset({
      buffer: result.buffer,
      folder: "audio",
      extension: "mp3",
      contentType: "audio/mpeg",
    })
  }

  /**
   * Private Helpers
   */
  private async _toBase64(
    input: Blob | Buffer | File | string,
  ): Promise<string> {
    if (typeof input === "string") {
      return input.replace(/^data:image\/\w+;base64,/, "")
    }
    if (Buffer.isBuffer(input)) {
      return input.toString("base64")
    }
    if (input instanceof Blob) {
      const arrayBuffer = await input.arrayBuffer()
      return Buffer.from(arrayBuffer).toString("base64")
    }
    return ""
  }

  private _sanitizeJSON(content: string): string {
    let clean = content.trim()
    if (clean.includes("```")) {
      const match = clean.match(/```(?:json)?\n?([\s\S]*?)\n?```/)
      if (match) {
        clean = match[1].trim()
      }
    }
    return clean
  }
}

export const aiService = new AIService()
