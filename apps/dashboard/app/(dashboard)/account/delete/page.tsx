import { requireSession } from "@/lib/auth/session";
import { userIdFromDeletionToken } from "@/lib/account/deletion";
import { ConfirmDelete } from "./confirm-delete";

export const dynamic = "force-dynamic";
export const metadata = { title: "Delete account" };

export default async function DeleteAccountPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const session = await requireSession();
  const { token = "" } = await searchParams;
  const tokenUser = userIdFromDeletionToken(token);
  const state = !tokenUser ? "invalid" : tokenUser !== session.user.id ? "wrong-account" : "ready";

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-3xl font-medium tracking-tight">Delete your account</h1>
      <ConfirmDelete token={token} state={state} email={session.user.email} />
    </div>
  );
}
