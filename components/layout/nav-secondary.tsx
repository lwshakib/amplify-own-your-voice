"use client"

import * as React from "react"
import { type Icon } from "@tabler/icons-react"
import { useTheme } from "next-themes"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { IconMoon, IconSun } from "@tabler/icons-react"

export function NavSecondary({
  items,
  ...props
}: {
  items: {
    title: string
    url: string
    icon: Icon
    onClick?: () => void
  }[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isSettings = item.title === "Settings"

            const content = (
              <>
                <item.icon />
                <span>{item.title}</span>
              </>
            )

            if (isSettings) {
              return (
                <SidebarMenuItem key={item.title}>
                  <Popover>
                    <PopoverTrigger asChild>
                      <SidebarMenuButton className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                        {content}
                      </SidebarMenuButton>
                    </PopoverTrigger>
                    <PopoverContent
                      side="top"
                      align="start"
                      sideOffset={4}
                      className="w-64 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-primary">
                          {resolvedTheme === "dark" ? (
                            <IconMoon className="size-4" />
                          ) : (
                            <IconSun className="size-4" />
                          )}
                          <Label
                            htmlFor="dark-mode"
                            className="text-sm font-medium text-foreground"
                          >
                            Dark Mode
                          </Label>
                        </div>
                        {mounted && (
                          <Switch
                            id="dark-mode"
                            checked={resolvedTheme === "dark"}
                            onCheckedChange={(checked) =>
                              setTheme(checked ? "dark" : "light")
                            }
                          />
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </SidebarMenuItem>
              )
            }

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild={!item.onClick}
                  onClick={item.onClick}
                >
                  {item.onClick ? content : <a href={item.url}>{content}</a>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
