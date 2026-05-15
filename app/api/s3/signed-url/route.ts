import { NextRequest, NextResponse } from 'next/server';
import { s3Service } from '@/services/s3.services';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

/**
 * Handles the generation of signed GET URLs for viewing/streaming private assets.
 */
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const path = req.nextUrl.searchParams.get('path');

    if (!path) {
      return NextResponse.json({ error: 'Missing object path' }, { status: 400 });
    }

    const url = await s3Service.getSignedDownloadUrl(path);

    return NextResponse.json({ url });
  } catch (error: any) {
    console.error('[S3 Signed URL Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
