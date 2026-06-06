import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import prisma from "./prisma"
import { Resend } from "resend"
import { AuthEmailTemplate } from "@/components/emails/auth-email-template"

const resend = new Resend(process.env.RESEND_API_KEY)

/**
 * Server-side Better Auth configuration.
 * Configures database adapters, authentication methods, social providers, and email handlers.
 */
export const auth = betterAuth({
  /**
   * Database adapter for Prisma.
   * Connects Better Auth to the PostgreSQL database for storing users, sessions, and accounts.
   */
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  /**
   * Social Authentication Providers.
   * Configures OAuth2 flows for platforms like Google.
   */
  socialProviders: {
    google: {
      enabled: true,
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },

  /**
   * Account behavior settings.
   */
  account: {
    /**
     * Automatically links accounts that share the same verified email address.
     */
    accountLinking: {
      enabled: true,
    },
  },
})
