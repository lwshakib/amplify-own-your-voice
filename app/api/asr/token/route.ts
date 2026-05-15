import { NextResponse } from "next/server"

export async function GET() {
  const secret = process.env.FLUX_JWT_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: "ASR Secret not configured" },
      { status: 500 },
    )
  }

  try {
    const encoder = new TextEncoder()

    // Create payload
    const payload = {
      exp: Math.floor(Date.now() / 1000) + 5 * 60, // 5 minutes
      iat: Math.floor(Date.now() / 1000),
    }

    // Encode payload to base64url
    const payloadStr = JSON.stringify(payload)
    const base64Payload = Buffer.from(payloadStr)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")

    // Import key for signing
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    )

    // Sign the payload
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(base64Payload),
    )

    // Convert signature to base64url
    const signatureBase64 = Buffer.from(signatureBuffer)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")

    const token = `${base64Payload}.${signatureBase64}`

    return NextResponse.json({ token })
  } catch (error: unknown) {
    console.error("Token generation error:", error)
    return NextResponse.json(
      { error: "Failed to generate asr token" },
      { status: 500 },
    )
  }
}
