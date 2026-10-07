import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";
import { sendEmail } from "../email/transport";
import { renderEmail } from "../email/templates";
import { SUSPENDED_MESSAGE, getSuspension } from "./suspended";

/**
 * New accounts must confirm their email before they can sign in. Off until the email provider is
 * known to deliver (RESEND_API_KEY) and the accounts that already exist have been marked verified
 * (`npm run auth:verify-existing`). See docs/deployment.md.
 */
export const REQUIRE_EMAIL_VERIFICATION = process.env.REQUIRE_EMAIL_VERIFICATION === "true";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),

  // Email + password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: REQUIRE_EMAIL_VERIFICATION,
    resetPasswordTokenExpiresIn: 60 * 60, // 1 hour
    sendResetPassword: async ({ user, url }) => {
      const { html, text } = renderEmail({
        title: "Reset your Vouchreel password",
        body: "We received a request to reset your password. This link expires in 1 hour. If you did not ask for it, you can ignore this email.",
        cta: { label: "Choose a new password", url },
        footer: "For your security, never forward this email.",
      });
      // Not awaited by Better Auth's response path timing-wise: failures are logged, never thrown to the caller
      await sendEmail({ to: user.email, subject: "Reset your Vouchreel password", text, html });
    },
  },

  emailVerification: {
    // A sign-in attempt by someone who has not confirmed sends a fresh link (covers a lost or expired email)
    sendOnSignUp: REQUIRE_EMAIL_VERIFICATION,
    sendOnSignIn: REQUIRE_EMAIL_VERIFICATION,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24, // 24 hours
    sendVerificationEmail: async ({ user, url }) => {
      const { html, text } = renderEmail({
        title: "Confirm your email address",
        body: "Welcome to Vouchreel. Confirm your email address to finish creating your account. This link expires in 24 hours. If you did not sign up, you can ignore this email.",
        cta: { label: "Confirm my email", url },
        footer: "For your security, never forward this email.",
      });
      await sendEmail({ to: user.email, subject: "Confirm your Vouchreel email address", text, html });
    },
  },

  // OAuth providers
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
  },

  // Expose the platform-admin flag on the session user (server-controlled, never client input)
  user: {
    additionalFields: {
      isPlatformAdmin: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
    },
  },

  // A suspended account cannot sign in (an open session is cut off in getSession)
  databaseHooks: {
    session: {
      create: {
        before: async (newSession) => {
          const { suspended } = await getSuspension(newSession.userId);
          if (suspended) throw new APIError("FORBIDDEN", { message: SUSPENDED_MESSAGE });
          return { data: newSession };
        },
      },
    },
  },

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // Cache for 5 minutes
    },
  },

});

export type Session = typeof auth.$Infer.Session;
