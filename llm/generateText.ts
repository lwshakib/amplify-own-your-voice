import { ai } from "./client"
import { CHAT_MODEL_ID } from "./constants"
import { normalizeMessages, Message } from "./utils"

export interface GenerateTextOptions {
  temperature?: number
  systemInstruction?: string
}

export async function generateText(
  messages: Message[],
  options?: GenerateTextOptions,
): Promise<string> {
  const { contents, systemInstruction } = normalizeMessages(
    messages,
    options?.systemInstruction,
  )

  const response = await ai.models.generateContent({
    model: CHAT_MODEL_ID,
    contents,
    config: {
      temperature: options?.temperature,
      systemInstruction: systemInstruction,
    },
  })

  return response.text || ""
}
