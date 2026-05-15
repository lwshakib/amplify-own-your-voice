"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { IconCirclePlusFilled, IconPlus, type Icon } from "@tabler/icons-react"
import { motion } from "motion/react"

import { Button } from "@/components/ui/button"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { QuickCreateDialog } from "@/components/modals/quick-create-dialog"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: Icon
  }[]
}) {
  const pathname = usePathname()
  const [isQuickCreateOpen, setIsQuickCreateOpen] = React.useState(false)
  return (
    <SidebarGroup className="overflow-visible">
      <SidebarGroupContent className="flex flex-col gap-2 overflow-visible">
        <SidebarMenu className="overflow-visible">
          <SidebarMenuItem className="flex items-center gap-2">
            <SidebarMenuButton
              tooltip="Quick Create"
              onClick={() => setIsQuickCreateOpen(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground min-w-8 duration-200 ease-linear"
            >
              <IconCirclePlusFilled />
              <span>Quick Create</span>
            </SidebarMenuButton>
            <Button
              size="icon"
              onClick={() => setIsQuickCreateOpen(true)}
              className="size-8 group-data-[collapsible=icon]:opacity-0"
              variant="outline"
            >
              <IconPlus className="size-4" />
              <span className="sr-only">Quick Create</span>
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu className="overflow-visible">
          {items.map((item) => {
            const isActive = pathname === item.url
            return (
              <SidebarMenuItem
                key={item.title}
                className="relative overflow-visible"
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-active-indicator"
                    className="absolute -left-4 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary z-10 rounded-r-full group-data-[collapsible=icon]:hidden"
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 30,
                    }}
                  />
                )}
                <SidebarMenuButton asChild tooltip={item.title}>
                  <Link href={item.url}>
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
      <QuickCreateDialog
        open={isQuickCreateOpen}
        onOpenChange={setIsQuickCreateOpen}
      />
    </SidebarGroup>
  )
}
