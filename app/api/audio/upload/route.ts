import { uploadAsset, getSignedDownloadUrl } from "@/lib/s3"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get("file") as Blob

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { path } = await uploadAsset({
      buffer,
      folder: "user-recordings",
      extension: "wav", // Audio blobs from browser are often wav or webm, wav is a safe bet for recordings here
      contentType: "audio/wav",
    })

    const signedUrl = await getSignedDownloadUrl(path)

    return NextResponse.json({
      path,
      url: signedUrl,
    })
  } catch (error: unknown) {
    console.error("Audio Upload Error:", error)
    return NextResponse.json(
      { error: "Failed to upload audio" },
      { status: 500 },
    )
  }
}
