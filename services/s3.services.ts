import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as env from '@/lib/env';
import { v4 as uuidv4 } from 'uuid';

/**
 * AWS S3 / Cloudflare R2 Service Class
 * Handles all direct and server-side interactions with the storage bucket.
 */
export class S3Service {
  private client: S3Client;
  private bucket: string;
  private region: string;
  private endpoint?: string;

  constructor() {
    this.region = env.AWS_REGION!;
    this.bucket = env.AWS_S3_BUCKET_NAME!;
    this.endpoint = env.AWS_ENDPOINT;

    if (!this.region || !this.bucket) {
      throw new Error('S3 Configuration error: AWS_REGION and AWS_S3_BUCKET_NAME must be defined in environment variables.');
    }

    this.client = new S3Client({
      region: this.region,
      ...(this.endpoint && { endpoint: this.endpoint }),
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  /**
   * Constructs the internal URL for an object path.
   * 
   * @param path - The destination path in the bucket.
   * @returns The public URL of the object.
   */
  _getInternalUrl(path: string): string {
    const baseUrl = this.endpoint 
      ? this.endpoint.replace(/\/$/, '') 
      : `https://${this.bucket}.s3.${this.region}.amazonaws.com`;
    
    return `${baseUrl}/${path}`;
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
  async uploadAsset({
    buffer,
    folder,
    extension,
    contentType
  }: {
    buffer: Buffer;
    folder: string;
    extension: string;
    contentType: string;
  }): Promise<{ path: string }> {
    const path = `${folder}/${uuidv4()}.${extension}`;
    await this.uploadBuffer(buffer, path, contentType);
    return { path };
  }

  /**
   * Uploads a buffer directly to the bucket from the server.
   * 
   * @param buffer - The file content as a Buffer.
   * @param path - The destination path (key) in the bucket.
   * @param contentType - The MIME type of the file.
   * @returns The public URL of the uploaded object (for internal use).
   */
  async uploadBuffer(
    buffer: Buffer,
    path: string,
    contentType: string
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: path,
      Body: buffer,
      ContentType: contentType,
    });

    await this.client.send(command);
    
    return this._getInternalUrl(path);
  }

  /**
   * Generates a presigned URL for secure client-side uploading.
   * 
   * @param path - The destination path in the bucket.
   * @param contentType - The expected MIME type.
   * @param expiresIn - Expiration time in seconds (default 1 hour).
   * @returns The presigned PUT URL.
   */
  async getPresignedUploadUrl(
    path: string,
    contentType: string,
    expiresIn = 3600
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: path,
      ContentType: contentType,
    });

    return await getSignedUrl(this.client, command, { expiresIn });
  }

  /**
   * Generates a signed URL for secure client-side downloading/viewing.
   * 
   * @param path - The path of the object in the bucket.
   * @param expiresIn - Expiration time in seconds (default 1 hour).
   * @returns The signed GET URL.
   */
  async getSignedDownloadUrl(
    path: string,
    expiresIn = 3600
  ): Promise<string> {
    // If the path is already a full URL, return it as-is to avoid double-signing
    if (path.startsWith('http')) {
      return path;
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: path,
    });

    return await getSignedUrl(this.client, command, { expiresIn });
  }

  /**
   * Deletes an object from the bucket.
   * 
   * @param path - The path of the object to delete.
   */
  async deleteFile(path: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: path,
    });

    await this.client.send(command);
  }

  /**
   * Direct access to the S3 client instance if needed.
   */
  getClient(): S3Client {
    return this.client;
  }
}

// Export a singleton instance for global use
export const s3Service = new S3Service();
