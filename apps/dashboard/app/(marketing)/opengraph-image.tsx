import { ImageResponse } from "next/og";

export const alt = "Vouchreel — Turn customer love into conversions";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
          backgroundColor: "#0B0B12",
          backgroundImage:
            "radial-gradient(circle at 18% 0%, rgba(99,102,241,0.38) 0%, rgba(11,11,18,0) 55%), radial-gradient(circle at 92% 100%, rgba(168,85,247,0.30) 0%, rgba(11,11,18,0) 50%)",
          padding: "72px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, #6366f1, #a855f7)",
              color: "#ffffff",
              fontSize: "34px",
              fontWeight: 700,
            }}
          >
            V
          </div>
          <div style={{ display: "flex", color: "#ffffff", fontSize: "34px", fontWeight: 600 }}>
            Vouchreel
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div
            style={{
              display: "flex",
              color: "#ffffff",
              fontSize: "76px",
              fontWeight: 700,
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
