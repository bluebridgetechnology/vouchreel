import { Logo } from "@/components/marketing/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-canvas px-4 py-8 sm:py-12">
      <Logo />
      <div className="flex w-full flex-1 items-center justify-center py-8">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
