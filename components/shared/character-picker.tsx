"use client"

import { CHARACTERS } from "@/lib/characters"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { motion } from "framer-motion"

interface CharacterPickerProps {
  onSelect: (characterId: string) => void
  selectedId?: string
  label: string
}

export function CharacterPicker({
  onSelect,
  selectedId,
  label,
}: CharacterPickerProps) {
  const filteredCharacters = CHARACTERS

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{label}</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {filteredCharacters.map((character) => {
          const isSelected = selectedId === character.id
          return (
            <motion.div
              key={character.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(character.id)}
              className={cn(
                "cursor-pointer rounded-xl border p-4 transition-all flex flex-col items-center text-center gap-3 relative",
                isSelected
                  ? "bg-primary/10 border-primary ring-1 ring-primary shadow-lg shadow-primary/10"
                  : "bg-muted/20 border-muted/50 hover:border-muted-foreground/50",
              )}
            >
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <Badge
                    variant="default"
                    className="size-4 p-0 flex items-center justify-center rounded-full"
                  >
                    ✓
                  </Badge>
                </div>
              )}
              <Avatar className="size-16 border-2 border-background">
                <AvatarImage src={character.avatar} alt={character.firstName} />
                <AvatarFallback>{character.firstName[0]}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <p className="font-bold text-sm">
                  {character.firstName} {character.lastName}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black italic">
                  {character.gender}
                </p>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
