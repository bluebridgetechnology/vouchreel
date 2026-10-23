import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import path from "node:path";

export const alt = "Vouchreel — Turn customer love into conversions";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The white-wordmark logo, inlined because the image renderer cannot fetch from the app itself.
const logoDataUri = `data:image/png;base64,${readFileSync(path.join(process.cwd(), "public/brand/logo-dark.png")).toString("base64")}`;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#1c1410",
          backgroundImage:
            "radial-gradient(circle at 18% 0%, rgba(217,71,27,0.42) 0%, rgba(28,20,16,0) 55%), radial-gradient(circle at 92% 100%, rgba(255,170,120,0.22) 0%, rgba(28,20,16,0) 50%)",
          padding: "72px",
        }}
      >
        <img src={logoDataUri} alt="" width={337} height={48} />

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div
            style={{
              display: "flex",
              color: "#ffffff",
              fontSize: "76px",
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
            }}
          >
            Turn customer love into conversions.
          </div>
          <div
            style={{
              display: "flex",
              color: "rgba(255,255,255,0.72)",
              fontSize: "30px",
            }}
          >
            Collect video testimonials with one link — embed them anywhere.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              borderRadius: "999px",
              border: "1px solid rgba(255,255,255,0.18)",
              padding: "10px 22px",
              color: "rgba(255,255,255,0.85)",
              fontSize: "22px",
            }}
          >
            vouchreel.com · Under 10KB embed · Zero layout shift
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
