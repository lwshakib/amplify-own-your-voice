import { NextRequest, NextResponse } from 'next/server';
import { getPresignedUploadUrl } from '@/lib/s3';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

/**
 * Handles the generation of presigned URLs for client-side uploads.
 */
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { path, contentType } = await req.json();

    if (!path || !contentType) {
      return NextResponse.json({ error: 'Missing path or contentType' }, { status: 400 });
    }

    const url = await getPresignedUploadUrl(path, contentType);

    return NextResponse.json({ url });
  } catch (error: any) {
    console.error('[S3 Presign Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
