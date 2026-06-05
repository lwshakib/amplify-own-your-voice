import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import * as env from "@/lib/env"
import { v4 as uuidv4 } from "uuid"

const region = env.AWS_REGION!
const bucket = env.AWS_S3_BUCKET_NAME!
const endpoint = env.AWS_ENDPOINT

if (!region || !bucket) {
  throw new Error(
    "S3 Configuration error: AWS_REGION and AWS_S3_BUCKET_NAME must be defined in environment variables.",
  )
}

export const s3Client = new S3Client({
  region,
  ...(endpoint && { endpoint }),
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
  },
})

/**
 * Constructs the internal URL for an object path.
 *
 * @param path - The destination path in the bucket.
 * @returns The public URL of the object.
 */
function getInternalUrl(path: string): string {
  const baseUrl = endpoint
    ? endpoint.replace(/\/$/, "")
    : `https://${bucket}.s3.${region}.amazonaws.com`

  return `${baseUrl}/${path}`
}

/**
 * Universal asset uploader.
 * Generates a unique path with the bucket prefix and uploads the buffer.
 *
 * @param buffer - File content.
 * @param folder - Destination folder (audio, images, etc).
 * @param extension - File extension without dot (mp3, png, etc).
 * @param contentType - MIME type.
 */
export async function uploadAsset({
  buffer,
  folder,
  extension,
  contentType,
}: {
  buffer: Buffer
  folder: string
  extension: string
  contentType: string
}): Promise<{ path: string }> {
  const path = `${folder}/${uuidv4()}.${extension}`
  await uploadBuffer(buffer, path, contentType)
  return { path }
}

/**
 * Uploads a buffer directly to the bucket from the server.
 *
 * @param buffer - The file content as a Buffer.
 * @param path - The destination path (key) in the bucket.
 * @param contentType - The MIME type of the file.
 * @returns The public URL of the uploaded object (for internal use).
 */
export async function uploadBuffer(
  buffer: Buffer,
  path: string,
  contentType: string,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: path,
    Body: buffer,
    ContentType: contentType,
  })

  await s3Client.send(command)

  return getInternalUrl(path)
}

/**
 * Generates a presigned URL for secure client-side uploading.
 *
 * @param path - The destination path in the bucket.
 * @param contentType - The expected MIME type.
 * @param expiresIn - Expiration time in seconds (default 1 hour).
 * @returns The presigned PUT URL.
 */
export async function getPresignedUploadUrl(
  path: string,
  contentType: string,
  expiresIn = 3600,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: path,
    ContentType: contentType,
  })

  return await getSignedUrl(s3Client, command, { expiresIn })
}

/**
 * Generates a signed URL for secure client-side downloading/viewing.
 *
 * @param path - The path of the object in the bucket.
 * @param expiresIn - Expiration time in seconds (default 1 hour).
 * @returns The signed GET URL.
 */
export async function getSignedDownloadUrl(
  path: string,
  expiresIn = 3600,
): Promise<string> {
  // If the path is already a full URL, return it as-is to avoid double-signing
  if (path.startsWith("http")) {
    return path
  }

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: path,
  })

  return await getSignedUrl(s3Client, command, { expiresIn })
}

/**
 * Deletes an object from the bucket.
 *
 * @param path - The path of the object to delete.
 */
export async function deleteFile(path: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: path,
  })

  await s3Client.send(command)
}

/**
 * Direct access to the S3 client instance if needed.
 */
export function getClient(): S3Client {
  return s3Client
}
