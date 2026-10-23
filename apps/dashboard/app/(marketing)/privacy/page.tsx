import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Privacy policy",
  description: "What Vouchreel collects, why, how long it is kept, and how to have it removed.",
  path: "/privacy",
});

/*
 * This describes what the software does today (see docs/retention.md). It is not legal advice and it names no
 * company, address or governing law: have whoever is responsible for privacy and legal matters review and complete
 * it before launch (gaps register item B11).
 */
const sections: LegalSection[] = [
  {
    title: "Who this covers",
    body: [
      "Vouchreel lets businesses collect video and written testimonials from their customers and show them on their websites. Three groups of people are involved, and this page explains what happens to each group's information: people with a Vouchreel account, people who give a testimonial, and visitors to a website that shows a Vouchreel widget.",
    ],
  },
  {
    title: "People with an account",
    body: ["When you create an account and use Vouchreel we keep what you give us and what you create:"],
    list: [
      "Your name, email address, a hashed password, sign-in sessions and, if you turn it on, your two-factor details.",
      "Your spaces, testimonials, collection forms, widgets, brand settings, reviews you import, API keys, webhooks, notifications and team links.",
      "The videos, thumbnails and clips you upload or that Vouchreel makes for you, including social exports and review videos.",
      "Your subscription. Card payments are handled by our payment providers, Stripe or Dodo Payments. Vouchreel does not store card numbers.",
    ],
  },
  {
    title: "People who give a testimonial",
    body: [
      "If a business sends you a Vouchreel link and you record a video or write a testimonial, the business that asked for it holds your name, email, words and video. Vouchreel stores them on that business's behalf.",
      "The form records what you agreed to, when and how. The business can see that record. You can withdraw your consent, and the business can delete your testimonial and everything held under your email address.",
    ],
  },
  {
    title: "Visitors to websites that use a Vouchreel widget",
    body: [
      "The widget counts views, plays and clicks so the site owner can see what works. This analytics is first-party: it is stored by Vouchreel for that site owner, and the widget does not set third-party advertising cookies. These events describe visitor activity on the site, not who a visitor is.",
    ],
  },
  {
    id: "cookies",
    title: "Cookies",
    body: [
      "Vouchreel sets only the cookies it needs to work. We do not use advertising, tracking or analytics cookies from other companies.",
    ],
    list: [
      "A sign-in cookie that keeps you signed in to your account.",
      "A cookie that remembers whether you collapsed the dashboard sidebar.",
      "A short-lived cookie used while you connect a Google reviews account.",
      "Your choice of light or dark appearance, and that you have read the cookie notice, are kept in your browser's own storage.",
    ],
  },
  {
    title: "How long we keep things",
    body: [],
    list: [
      "Account information and everything in the account: until the account is deleted.",
      "When an account is deleted, its data is removed together, and its stored files are queued for deletion and removed by a background job.",
      "A downloadable copy of your data: 7 days, then deleted automatically.",
      "Payment records are kept by Stripe or Dodo Payments for as long as the law requires.",
      "Our own logs and error reports are cleaned of email addresses, tokens and testimonial text before they are written, and are kept for a limited time.",
      "Deleted data can remain in backups until those backups expire.",
    ],
  },
  {
    title: "Your choices",
    body: [
      "Account holders can delete their account, download their data, and delete a person's testimonials and data from the settings pages. People who gave a testimonial can withdraw their consent through the link in their confirmation, or ask the business that collected it to remove it. If you need help with any of this, write to us.",
    ],
  },
  {
    title: "Who we share information with",
    body: [
      "We do not sell personal information. We use service providers to run Vouchreel: hosting and storage, email delivery, payments (Stripe and Dodo Payments) and, if enabled, error tracking. They process information only to provide their service to us.",
    ],
  },
  {
    title: "Changes and contact",
    body: [
      "If we change this page we will update the date at the top. Questions or requests about your information: support@vouchreel.com.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="23 October 2026"
      intro="This page explains what Vouchreel keeps about the people who use it, why, for how long, and how you can have it removed."
      sections={sections}
    />
  );
}
