import { notFound } from "next/navigation";
import { fontAccent } from "@/lib/fonts-accent";

export const metadata = { title: "Design system", robots: { index: false } };

export default function DesignLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <div className={fontAccent.variable}>{children}</div>;
}
