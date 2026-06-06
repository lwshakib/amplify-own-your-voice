"use client"

import { motion } from "framer-motion"
import { Logo } from "@/components/layout/logo"
import { IconSparkles, IconActivity, IconLock, IconMessageChatbot, IconVolume } from "@tabler/icons-react"

export function AuthVisual() {
  // 17 bars for a minimal soundwave visualizer
  const bars = Array.from({ length: 17 })

  return (
    <div className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-zinc-950 p-12 text-white">
      {/* Subtle, soft background glow using theme color (primary) */}
      <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
        <div className="h-[300px] w-[300px] rounded-full bg-primary/5 blur-[80px]" />
      </div>

      {/* Top Brand Logo */}
      <div className="relative z-10">
        <Logo />
      </div>

      {/* Center - Minimal Soundwave Visualization */}
      <div className="relative z-10 flex flex-1 items-center justify-center">
        <div className="flex items-center gap-1.5 h-32">
          {bars.map((_, i) => {
            // Generate symmetric heights for a neat, balanced look
            const distanceFromCenter = Math.abs(i - 8)
            const baseHeight = Math.max(12, 64 - distanceFromCenter * 6)
            
            // Animation height boundaries
            const minHeight = baseHeight * 0.35
            const maxHeight = baseHeight * 1.25
            
            return (
              <motion.div
                key={i}
                className="w-1.5 rounded-full bg-primary"
                style={{
                  height: baseHeight,
                  opacity: 0.2 + (1 - distanceFromCenter / 9) * 0.8
                }}
                animate={{
                  height: [minHeight, maxHeight, minHeight],
                }}
                transition={{
                  duration: 1.4 + (i % 3) * 0.25,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.04,
                }}
              />
            )
          })}
        </div>
      </div>

      {/* Bottom Content - Minimal & Sleek */}
      <div className="relative z-10 space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">
          Amplify your voice
        </h2>
        <p className="max-w-xs text-xs text-zinc-400 leading-relaxed">
          Train and master your communication skills with real-time AI mock interviews and debates.
        </p>
      </div>
    </div>
  )
}
