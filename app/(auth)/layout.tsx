/**
 * @file app/(auth)/layout.tsx
 * @description Layout wrapper for all authentication-related pages (Sign In, Sign Up, etc.).
 * This ensures a consistent structure for the auth flow.
 */

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode // The specific auth page being rendered
}>) {
  return (
    /**
     * Auth Layout Container
     * Uses min-h-screen to ensure the auth forms are centered or properly spaced on the viewport.
     */
    <div className="min-h-screen w-full">{children}</div>
  )
}
