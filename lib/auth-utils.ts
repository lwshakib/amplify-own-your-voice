import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

/**
 * Validates the current user session.
 * Returns the session object if valid, otherwise returns a NextResponse with 401.
 */
export async function validateSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    return {
      session: null,
      errorResponse: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      ),
    }
  }

  return { session, errorResponse: null }
}
