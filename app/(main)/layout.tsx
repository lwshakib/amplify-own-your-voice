/**
 * @file app/(main)/layout.tsx
 * @description The primary layout for the authenticated section of the application.
 * This layout includes the sidebar navigation, top header, and global search functionality.
 */

import { AppSidebar } from "@/components/layout/app-sidebar" // The collapsible side navigation
import { SiteHeader } from "@/components/layout/site-header" // The top bar containing breadcrumbs/actions
import { SearchDialog } from "@/components/modals/search-dialog" // Global search modal triggered by shortcuts
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar" // Sidebar structural components
import NextTopLoader from "nextjs-toploader" // Progress bar for route transitions
import { Suspense } from "react" // For handling asynchronous component loading

/**
 * MainLayoutPage Component
 * @param children - The specific page content (Dashboard, Interviews, etc.)
 * @returns The structured main application shell with navigation and utility components
 */
export default function MainLayoutPage({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    /**
     * SidebarProvider: Manages the state and layout variables of the sidebar.
     * Custom CSS variables are defined here for consistent spacing across nested components.
     */
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      {/* 
        NextTopLoader: Shows a visual indicator at the top of the viewport when 
        navigating between pages. Styled to match the primary theme color.
      */}
      <NextTopLoader
        color="var(--primary)"
        initialPosition={0.08}
        crawlSpeed={200}
        height={2}
        crawl={true}
        showSpinner={false}
        easing="ease"
        speed={200}
        shadow="0 0 10px var(--primary), 0 0 5px var(--primary)"
      />

      {/* The Sidebar component, using the 'inset' variant for a floating look */}
      <AppSidebar variant="inset" />

      {/* SidebarInset: The main content area that shifts when the sidebar is opened/closed */}
      <SidebarInset>
        {/* SiteHeader: Top navigation/context bar. Wrapped in Suspense for potential search param usage. */}
        <Suspense>
          <SiteHeader />
        </Suspense>

        {/* The actual page content */}
        {children}
      </SidebarInset>

      {/* Global search dialog, accessible via keyboard shortcuts throughout the (main) section */}
      <Suspense>
        <SearchDialog />
      </Suspense>
    </SidebarProvider>
  )
}
