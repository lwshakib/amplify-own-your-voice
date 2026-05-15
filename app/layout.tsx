/**
 * @file app/layout.tsx
 * @description The root layout component for the Amplify application.
 * This file defines the global HTML structure, metadata, and common providers.
 */

import type { Metadata } from "next"
import "./globals.css" // Global stylesheet for the entire application
import { ThemeProvider } from "@/components/shared/theme-provider" // Theme management provider (light/dark/system)
import { Toaster } from "@/components/ui/sonner" // Notification toaster for global alerts

/**
 * Global Metadata Configuration
 * This defines the base SEO and iconography for the application.
 */
export const metadata: Metadata = {
  title: "Amplify | Own Your Voice",
  description:
    "Amplify help you prepare for your interviews, debates, and professional communication with AI-powered insights.",
  icons: {
    // Standard favicons and app icons in various sizes
    icon: [
      {
        url: "/favicon_io/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
      {
        url: "/favicon_io/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      { url: "/favicon_io/favicon.ico", sizes: "any", type: "image/x-icon" },
      {
        url: "/favicon_io/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/favicon_io/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    // Apple touch icon for iOS devices
    apple: "/favicon_io/apple-touch-icon.png",
  },
  // Progressive Web App (PWA) manifest
  manifest: "/favicon_io/site.webmanifest",
}

/**
 * RootLayout Component
 * @param children - The page content to be rendered within the layout
 * @returns The top-level HTML structure with global providers
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // suppressHydrationWarning is used to avoid mismatches when using next-themes
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        {/* ThemeProvider manages light/dark/system theme modes via CSS classes */}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* Main content of the page */}
          {children}

          {/* Toaster component to render notifications globally */}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
