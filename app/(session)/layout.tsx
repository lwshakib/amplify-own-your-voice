/**
 * @file app/(session)/layout.tsx
 * @description Layout wrapper for intensive session pages (Interviews or Debates).
 * These pages typically use a full-screen or focused UI to minimize distractions.
 */

export default function SessionLayout({
  children,
}: {
  children: React.ReactNode // The session-specific page content
}) {
  return (
    /**
     * Session Layout Container
     * Uses a flex column and min-h-screen to ensure the session runner
     * occupies the full viewport height.
     */
    <div className="flex min-h-screen flex-col bg-background">{children}</div>
  )
}
