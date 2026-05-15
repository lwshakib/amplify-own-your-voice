"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Pause, Play } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  AudioPlayerProvider,
  useAudioPlayer,
} from "@/components/ui/audio-player"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import type { Character } from "@/lib/characters"

interface VoicePickerProps {
  voices: Character[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  className?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function VoicePicker({
  voices,
  value,
  onValueChange,
  placeholder = "Select a voice...",
  className,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: VoicePickerProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = openProp !== undefined
  const isOpen = isControlled ? openProp : internalOpen
  const setIsOpen = isControlled ? onOpenChangeProp : setInternalOpen

  const selectedVoice = voices.find((v) => v.id === value)

  return (
    <AudioPlayerProvider>
      <Popover open={isOpen} onOpenChange={setIsOpen} modal={true}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={isOpen}
            className={cn(
              "w-full h-12 justify-between bg-muted/20 border-muted/50",
              className,
            )}
          >
            {selectedVoice ? (
              <div className="flex items-center gap-2 overflow-hidden">
                <Avatar className="size-6 shrink-0">
                  <AvatarImage
                    src={selectedVoice.avatar}
                    alt={selectedVoice.firstName}
                  />
                  <AvatarFallback>{selectedVoice.firstName[0]}</AvatarFallback>
                </Avatar>
                <span className="truncate">
                  {selectedVoice.firstName} {selectedVoice.lastName}
                </span>
              </div>
            ) : (
              placeholder
            )}
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
          onWheel={(e) => e.stopPropagation()}
        >
          <Command className="bg-popover">
            <CommandInput placeholder="Search voices..." />
            <CommandList>
              <CommandEmpty>No voice found.</CommandEmpty>
              <CommandGroup>
                {voices.map((voice) => (
                  <VoicePickerItem
                    key={voice.id}
                    voice={voice}
                    isSelected={value === voice.id}
                    onSelect={() => {
                      onValueChange?.(voice.id)
                      setIsOpen?.(false)
                    }}
                  />
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </AudioPlayerProvider>
  )
}

interface VoicePickerItemProps {
  voice: Character
  isSelected: boolean
  onSelect: () => void
}

function VoicePickerItem({
  voice,
  isSelected,
  onSelect,
}: VoicePickerItemProps) {
  const [isHovered, setIsHovered] = React.useState(false)
  const player = useAudioPlayer()

  const preview = voice.audio
  const audioItem = React.useMemo(
    () => (preview ? { id: voice.id, src: preview, data: voice } : null),
    [preview, voice],
  )

  const isPlaying =
    audioItem && player.isItemActive(audioItem.id) && player.isPlaying

  const handlePreview = React.useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (!audioItem) return

      if (isPlaying) {
        player.pause()
      } else {
        player.play(audioItem)
      }
    },
    [audioItem, isPlaying, player],
  )

  return (
    <CommandItem
      value={voice.id}
      onSelect={onSelect}
      className="flex items-center gap-3 p-2"
    >
      <div
        className="relative z-10 size-10 shrink-0 cursor-pointer overflow-hidden rounded-full border border-muted/50 flex items-center justify-center bg-muted/30"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handlePreview}
      >
        <Avatar className="size-full">
          <AvatarImage src={voice.avatar} alt={voice.firstName} />
          <AvatarFallback>{voice.firstName[0]}</AvatarFallback>
        </Avatar>

        {preview && (isHovered || isPlaying) && (
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition-opacity",
              isPlaying ? "opacity-100" : "opacity-0 hover:opacity-100",
            )}
          >
            {isPlaying ? (
              <Pause className="size-4 fill-white text-white" />
            ) : (
              <Play className="size-4 fill-white text-white" />
            )}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-0.5">
        <span className="font-medium">
          {voice.firstName} {voice.lastName}
        </span>
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <span className="capitalize">{voice.gender}</span>
          <span>•</span>
          <span className="text-[10px] font-bold tracking-tight opacity-70">
            {voice.model}
          </span>
        </div>
      </div>

      <Check
        className={cn(
          "ml-auto size-4 shrink-0",
          isSelected ? "opacity-100" : "opacity-0",
        )}
      />
    </CommandItem>
  )
}

export { VoicePicker, VoicePickerItem }
