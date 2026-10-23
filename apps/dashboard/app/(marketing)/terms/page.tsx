import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The terms for using Vouchreel to collect and show customer testimonials.",
  alternates: { canonical: "/terms" },
};

/*
 * Plain-language terms covering how the product works. It names no company and has no sections on warranties,
 * liability limits or governing law, because those need a lawyer: have the terms reviewed and completed before launch
 * (gaps register item B11).
 */
const sections: LegalSection[] = [
  {
    title: "Using Vouchreel",
    body: [
      "Vouchreel is a service for collecting video and written testimonials from your customers and showing them on your website. By creating an account or using the service you agree to these terms. If you use Vouchreel for a business, you confirm you can agree on its behalf.",
      "Keep your sign-in details safe. You are responsible for what happens under your account, including the people you invite to your team.",
    ],
  },
  {
    title: "Your content",
    body: [
      "You keep ownership of the testimonials, videos, reviews and other content you add to Vouchreel. You give us permission to store, process and display it as needed to run the service for you, for example to play a video in your widget or to make a clip you asked for.",
    ],
  },
  {
    title: "Permission from the people you feature",
    body: [
      "You must have permission from every person whose words, face or voice appear in your content, and you must use their content only in the ways they agreed to. Vouchreel's collection form records that agreement, but you remain responsible for it.",
      "If someone withdraws their consent, or asks you to remove their content, you must remove it. Vouchreel gives you tools to do this.",
    ],
  },
  {
    title: "What you must not do",
    body: ["You must not use Vouchreel to:"],
    list: [
      "Publish testimonials or reviews that are fake, paid for without saying so, or that you do not have the right to use.",
      "Upload content that is illegal, hateful, or that infringes someone else's rights.",
      "Break or probe the service, or use it to attack other people's sites.",
      "Bypass the limits of your plan.",
    ],
  },
  {
    title: "Plans and payment",
    body: [
      "Vouchreel has a free plan and paid plans. Paid plans are billed through our payment providers, Stripe or Dodo Payments, on the schedule you choose. You can cancel at any time from your billing settings. Prices and plan limits are shown on the pricing page and can change; we will not change what you have already paid for.",
    ],
  },
  {
    title: "Taking content down",
    body: [
      "We may remove content or suspend an account that breaks these terms or the law, or that puts others at risk. Where we can, we will tell you why.",
    ],
  },
  {
    title: "Ending your account",
    body: [
      "You can delete your account at any time from your settings, which removes your data as described in the privacy policy. We may end or suspend accounts that break these terms.",
    ],
  },
  {
    title: "Changes and contact",
    body: [
      "We may update these terms. If a change matters, we will tell you before it applies. Questions: support@vouchreel.com.",
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      updated="23 October 2026"
      intro="These are the ground rules for using Vouchreel, written in plain language."
      sections={sections}
    />
  );
}
