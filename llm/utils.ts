export interface Message {
  role: string
  content: string
}

export function normalizeMessages(
  messages: Message[],
  overrideSystemInstruction?: string,
) {
  const systemMessages = messages.filter((m) => m.role === "system")
  const otherMessages = messages.filter((m) => m.role !== "system")

  let systemInstruction = overrideSystemInstruction || ""
  if (systemMessages.length > 0) {
    const combinedSystem = systemMessages.map((m) => m.content).join("\n\n")
    if (systemInstruction) {
      systemInstruction = `${systemInstruction}\n\n${combinedSystem}`
    } else {
      systemInstruction = combinedSystem
    }
  }

  const contents = otherMessages.map((m) => ({
    role:
      m.role === "assistant" ? "model" : m.role === "model" ? "model" : "user",
    parts: [{ text: m.content }],
  }))

  return {
    contents,
    systemInstruction: systemInstruction || undefined,
  }
}
