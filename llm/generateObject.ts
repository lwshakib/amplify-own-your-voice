import { ai } from "./client"
import { CHAT_MODEL_ID } from "./constants"
import { z } from "zod"
import { normalizeMessages, Message } from "./utils"

export interface GenerateObjectOptions {
  temperature?: number
  systemInstruction?: string
}

function toGeminiSchema(val: any): any {
  if (!val || typeof val !== "object") return val

  if (Array.isArray(val)) {
    return val.map(toGeminiSchema)
  }

  const result: any = {}
  for (const key of Object.keys(val)) {
    if (key === "$schema" || key === "additionalProperties") {
      continue
    }
    if (key === "type" && typeof val[key] === "string") {
      result[key] = val[key].toUpperCase()
    } else {
      result[key] = toGeminiSchema(val[key])
    }
  }
  return result
}

export async function generateObject<T = any>(
  messagesOrParams: Message[] | { messages: Message[]; outputSchema: any },
  schema?: z.ZodSchema<T> | any,
  options?: GenerateObjectOptions,
): Promise<T> {
  let actualMessages: Message[]
  let actualSchema: z.ZodSchema<T> | any

  if (Array.isArray(messagesOrParams)) {
    actualMessages = messagesOrParams
    actualSchema = schema
  } else {
    actualMessages = messagesOrParams.messages
    actualSchema = messagesOrParams.outputSchema
  }

  const { contents, systemInstruction } = normalizeMessages(
    actualMessages,
    options?.systemInstruction,
  )

  let jsonSchema: any
  if (actualSchema && typeof actualSchema.toJSONSchema === "function") {
    jsonSchema = actualSchema.toJSONSchema()
  } else {
    jsonSchema = actualSchema
  }

  const geminiSchema = toGeminiSchema(jsonSchema)

  const response = await ai.models.generateContent({
    model: CHAT_MODEL_ID,
    contents,
    config: {
      temperature: options?.temperature,
      systemInstruction: systemInstruction,
      responseMimeType: "application/json",
      responseSchema: geminiSchema,
    },
  })

  const text = response.text
  console.log("Raw response text:", text)
  if (!text) {
    throw new Error("Empty response from model")
  }

  const parsed = JSON.parse(text)

  if (actualSchema && typeof actualSchema.parse === "function") {
    return actualSchema.parse(parsed)
  }
  return parsed as T
}
