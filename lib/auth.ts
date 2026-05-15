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
   * Email and Password configuration.
   * Enables standard email-based sign-in and handles password reset emails via Resend.
   */
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    /**
     * Handler for sending password reset emails.
     */
    sendResetPassword: async ({ user, url }) => {
      try {
        const { error } = await resend.emails.send({
          from: "Amplify <noreply@lwshakib.site>",
          to: user.email,
          subject: "Reset your password",
          react: AuthEmailTemplate({ type: "forgot-password", url }),
        })

        if (error) {
          console.error("Failed to send email via Resend:", error)
          throw new Error("Failed to send authentication email.")
        }
      } catch (err: unknown) {
        console.error("Resend error:", err)
        throw err
      }
    },
  },

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
   * Email Verification configuration.
   * Manages the flow for verifying user email addresses after sign-up.
   */
  emailVerification: {
    autoSignInAfterVerification: false,
    redirectTo: "/verify-email",
    sendOnSignUp: true,
    /**
     * Handler for sending verification emails after sign-up.
     */
    sendVerificationEmail: async ({ user, url }) => {
      try {
        await resend.emails.send({
          from: "Amplify <noreply@lwshakib.site>",
          to: user.email,
          subject: "Verify your email address",
          react: AuthEmailTemplate({ type: "email-verification", url }),
        })
      } catch (err: unknown) {
        console.error("Verification email error:", err)
      }
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
