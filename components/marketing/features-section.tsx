"use client"

import { motion } from "framer-motion"
import {
  IconMessageDots,
  IconUsers,
  IconBulb,
  IconChartBar,
  IconTarget,
  IconShieldCheck,
} from "@tabler/icons-react"
import { Card, CardContent } from "@/components/ui/card"

const features = [
  {
    title: "AI Interview Coaching",
    description:
      "Practice with industry-specific interviewers who give real-time feedback on your answers and body language.",
    icon: IconMessageDots,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    title: "Debate Arena",
    description:
      "Challenge AI opponents in structured debates. Improve your logic, persuasion, and quick-thinking skills.",
    icon: IconUsers,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  {
    title: "Persona Marketplace",
    description:
      "Access a community-driven marketplace of specialized AI personalities, from tough bosses to empathetic mentors.",
    icon: IconBulb,
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
  },
  {
    title: "Detailed Analytics",
    description:
      "Track your progress over time with deep insights into your vocabulary, tone, and overall confidence score.",
    icon: IconChartBar,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    title: "Custom Scenarios",
    description:
      "Create your own practice scenarios. Perfect for preparing for salary negotiations or difficult client meetings.",
    icon: IconTarget,
    color: "text-rose-500",
    bg: "bg-rose-500/10",
  },
  {
    title: "Private & Secure",
    description:
      "Your data is yours. All practice sessions are private, encrypted, and never shared without your permission.",
    icon: IconShieldCheck,
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
  },
]

export default function FeaturesSection() {
  return (
    <section id="features" className="py-24 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-3xl md:text-5xl font-bold mb-4 tracking-tight"
          >
            Everything you need to{" "}
            <span className="text-primary italic">Amplify</span> your voice
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-muted-foreground text-lg max-w-2xl mx-auto"
          >
            Built for those who want to command any room. Whether it&apos;s a
            boardroom, a stage, or a screen.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="h-full border-muted/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 group">
                <CardContent className="p-8">
                  <div
                    className={`size-12 rounded-xl ${feature.bg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}
                  >
                    <feature.icon className={`size-6 ${feature.color}`} />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Background blobs */}
      <div className="absolute top-1/2 left-0 -translate-y-1/2 -z-10 w-64 h-64 bg-primary/10 rounded-full blur-[120px]" />
      <div className="absolute top-1/2 right-0 -translate-y-1/2 -z-10 w-64 h-64 bg-purple-500/10 rounded-full blur-[120px]" />
    </section>
  )
}
