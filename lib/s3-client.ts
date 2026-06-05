/**
 * CLIENT-SIDE ONLY: Uploads a file directly from the browser to S3/R2 storage.
 * Uses a presigned URL to perform a secure PUT request.
 *
 * @param file - File to upload (Blob or File).
 * @param type - Folder/prefix for the storage path (e.g., 'audio', 'images').
 * @returns The final storage path (key) of the uploaded file.
 */
export async function uploadToS3Client(
  file: Blob | File,
  type: "audio" | "images" | "avatars" = "images",
): Promise<string> {
  const extension = file.type.split("/")[1] || "bin"
  const fileName = `${type}/${crypto.randomUUID()}.${extension}`

  // 1. Get presigned URL from our API
  const response = await fetch("/api/s3/presigned-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: fileName,
      contentType: file.type,
    }),
  })

  if (!response.ok) {
    throw new Error("Failed to generate presigned upload URL")
  }

  const { url } = await response.json()

  // 2. Upload directly to S3 via PUT
  const uploadResponse = await fetch(url, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file.type,
    },
  })

  if (!uploadResponse.ok) {
    throw new Error("Failed to upload file to S3 storage")
  }

  // 3. Return the storage path (key)
  return fileName
}

/**
 * Resolves a storage path to a temporary signed download URL via our API.
 *
 * @param path - The path of the object in the bucket.
 * @returns The signed GET URL.
 */
export async function getSignedUrl(path: string): Promise<string> {
  if (!path || path.startsWith("http")) return path

  const response = await fetch(
    `/api/s3/signed-url?path=${encodeURIComponent(path)}`,
  )

  if (!response.ok) {
    throw new Error("Failed to resolve signed URL")
  }

  const { url } = await response.json()
  return url
}
