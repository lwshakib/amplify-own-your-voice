"use client"

import * as React from "react"
import {
  IconUser,
  IconRobot,
  IconUsers,
  IconReport,
  IconLoader2,
  IconSettings,
  IconClock,
  IconHelp,
  IconMail,
} from "@tabler/icons-react"

import { useRouter } from "next/navigation"
import { useSearch } from "@/hooks/use-search"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"

interface SearchResult {
  type: string
  id: string
  title: string
  url: string
  subtitle?: string
}

export function SearchDialog() {
  const router = useRouter()
  const { isOpen, setOpen } = useSearch()

  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [isHelpOpen, setIsHelpOpen] = React.useState(false)

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      setOpen(open)
      if (!open) {
        setQuery("")
        setResults([])
      }
    },
    [setOpen],
  )

  React.useEffect(() => {
    const fetchResults = async () => {
      if (!query.trim()) {
        setResults([])
        return
      }

      setIsLoading(true)
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query)}`,
        )
        const data = await response.json()
        setResults(data.results || [])
      } catch (error) {
        console.error("Search error:", error)
      } finally {
        setIsLoading(false)
      }
    }

    const timer = setTimeout(fetchResults, 300)
    return () => clearTimeout(timer)
  }, [query])

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(!isOpen)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [isOpen, setOpen])

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={handleOpenChange}
      shouldFilter={false}
    >
      <CommandInput
        placeholder="Type to search interviews, debates, and personas..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {!isLoading && results.length === 0 && query.length > 0 && (
          <CommandEmpty>No results found for &quot;{query}&quot;.</CommandEmpty>
        )}
        {!query && (
          <CommandGroup heading="Suggestions">
            <CommandItem onSelect={() => router.push("/interviews")}>
              <IconUsers className="mr-2 h-4 w-4" />
              <span>Browse Interviews</span>
            </CommandItem>
            <CommandItem onSelect={() => router.push("/debates")}>
              <IconReport className="mr-2 h-4 w-4" />
              <span>Browse Debates</span>
            </CommandItem>
            <CommandItem onSelect={() => router.push("/ai-personas")}>
              <IconRobot className="mr-2 h-4 w-4" />
              <span>AI Personas</span>
            </CommandItem>
          </CommandGroup>
        )}
        {results.length > 0 && (
          <CommandGroup heading="Search Results">
            {results.map((result) => (
              <CommandItem
                key={`${result.type}-${result.id}`}
                value={result.title} // Crucial for cmdk when shouldFilter is false
                onSelect={() => {
                  router.push(result.url)
                  setOpen(false)
                }}
              >
                {result.type.includes("Interview") && (
                  <IconUsers className="mr-2 h-4 w-4" />
                )}
                {result.type.includes("Debate") && (
                  <IconReport className="mr-2 h-4 w-4" />
                )}
                {result.type === "AI Persona" && (
                  <IconRobot className="mr-2 h-4 w-4" />
                )}
                {result.type.includes("Session") && (
                  <IconClock className="mr-2 h-4 w-4" />
                )}
                <div className="flex flex-col flex-1 truncate">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{result.title}</span>
                    <span className="text-[9px] text-muted-foreground uppercase tracking-widest shrink-0 px-1.5 py-0.5 rounded-sm bg-muted/50 font-bold border border-border/50">
                      {result.type}
                    </span>
                  </div>
                  {result.subtitle && (
                    <span className="text-[11px] text-muted-foreground truncate italic">
                      {result.subtitle}
                    </span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandSeparator />
        <CommandGroup heading="Help">
          <CommandItem onSelect={() => setIsHelpOpen(true)}>
            <IconHelp className="mr-2 h-4 w-4" />
            <span>Get Help</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Settings">
          <CommandItem onSelect={() => router.push("/settings/profile")}>
            <IconUser className="mr-2 h-4 w-4" />
            <span>Profile</span>
            <CommandShortcut>⌘P</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => router.push("/settings")}>
            <IconSettings className="mr-2 h-4 w-4" />
            <span>Settings</span>
            <CommandShortcut>⌘S</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>

      <HelpDialog open={isHelpOpen} onOpenChange={setIsHelpOpen} />
    </CommandDialog>
  )
}

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function HelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconHelp className="h-5 w-5 text-primary" />
            Get Help
          </DialogTitle>
          <DialogDescription>
            Need assistance or found a bug? We&apos;re here to help.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex items-center gap-4 rounded-lg border p-4 bg-muted/50">
            <div className="rounded-full bg-primary/10 p-2">
              <IconMail className="h-5 w-5 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">Email Support</span>
              <a
                href="mailto:leadwithshakib@gmail.com"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                leadwithshakib@gmail.com
              </a>
            </div>
          </div>
          <p className="text-xs text-muted-foreground px-1">
            Our team usually responds within 24 hours. Please include as much
            detail as possible in your email.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
