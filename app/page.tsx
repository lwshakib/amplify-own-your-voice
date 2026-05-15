/**
 * @file app/page.tsx
 * @description The landing page (Home) of the Amplify application.
 * This is the public-facing marketing page that users see before logging in.
 */

import FeaturesSection from "@/components/marketing/features-section" // Section highlighting key app features
import HeroSection from "@/components/marketing/hero-section" // Principal "Hero" section with CTA
import SimplePricing from "@/components/marketing/pricing" // Pricing information section
import FooterSection from "@/components/layout/footer" // Global footer for marketing pages

/**
 * Home Component
 * @returns The marketing landing page structure
 */
export default function Home() {
  return (
    <main className="min-h-screen w-full selection:bg-primary selection:text-primary-foreground">
      {/* 
        Hero Section: The first thing users see. 
        Usually contains the main value proposition and a "Get Started" button.
      */}
      <HeroSection />

      {/* 
        Max-width container for secondary sections (Features & Pricing)
      */}
      <div className="max-w-7xl mx-auto">
        {/* Features Section: Details about AI Interviews, Debates, etc. */}
        <FeaturesSection />

        {/* Pricing Section: Information about free and premium tiers */}
        <SimplePricing />
      </div>

      {/* Footer Section: Navigation links, socials, and copyright */}
      <FooterSection />
    </main>
  )
}
