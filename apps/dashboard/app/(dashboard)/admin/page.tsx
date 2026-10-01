import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getActivePaymentProviderName } from "@/lib/payments";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";
import { getFfmpegStatus } from "@/lib/media/ffmpeg";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminPanel } from "./admin-panel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await requireSession();

  if (!isPlatformAdmin(session.user)) {
    redirect("/dashboard");
  }

  const activeProvider = await getActivePaymentProviderName();
  const ffmpeg = await getFfmpegStatus(true);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight">Admin Settings</h1>
        <p className="text-text-muted mt-1 text-sm">
          Manage system-wide settings, payment processing gateways, and developer webhooks.
        </p>
      </div>

      <AdminPanel initialProvider={activeProvider} appUrl={appUrl} />

      <Card>
        <CardHeader>
          <CardTitle>System health</CardTitle>
          <CardDescription>
            Video transcoding and social exports need FFmpeg on the server. Serverless hosts cannot run it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span>FFmpeg</span>
            {ffmpeg.available ? (
              <Badge variant="success">Installed{ffmpeg.version ? ` · ${ffmpeg.version}` : ""}</Badge>
            ) : (
              <Badge variant="danger">Not installed</Badge>
            )}
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Burned-in captions (drawtext)</span>
            {ffmpeg.available ? (
              <Badge variant={ffmpeg.drawtext ? "success" : "warning"}>
                {ffmpeg.drawtext ? "Available" : "Missing filter"}
              </Badge>
            ) : (
              <Badge>Unknown</Badge>
            )}
          </div>
          {!ffmpeg.available && (
            <p className="rounded-control bg-danger-soft px-3 py-2 text-xs text-danger-foreground">
              {ffmpeg.error} Install it (winget install Gyan.FFmpeg, brew install ffmpeg, apt install ffmpeg) or set
              FFMPEG_PATH, then restart the server.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
