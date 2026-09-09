import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { LEAVE_MAIL } from "@/lib/domain/leave-mail";

export const alt = "Attendance — scan to punch in at the office";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Brand tokens from globals.css, resolved to hex: Satori has no CSS variables.
const BG = "#0a0d12";
const CARD = "#14181f";
const FG = "#f3f5f8";
const MUTED = "#8b949f";
const PRIMARY = "#2867e4";

function punchUrl() {
  const origin = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  return new URL("/attendance/wfo-punch", origin).toString();
}

export default async function Image() {
  const url = punchUrl();
  const guarded = !!process.env.OFFICE_IP_ADDRESS;
  // A PNG data URL: Satori renders raster images reliably, SVG less so.
  const qr = await QRCode.toDataURL(url, {
    margin: 1,
    width: 460,
    errorCorrectionLevel: "M",
    color: { dark: "#0a0d12ff", light: "#ffffffff" },
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: BG,
          color: FG,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", width: "100%", height: 8, background: PRIMARY }} />
        <div style={{ display: "flex", flex: 1 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 22,
            padding: "0 64px",
            flex: 1,
          }}
        >
          <div style={{ display: "flex", fontSize: 26, letterSpacing: 4, color: PRIMARY }}>
            ATTENDANCE
          </div>
          {/* Satori ignores <br />, so each line is its own element. */}
          <div style={{ display: "flex", flexDirection: "column", fontSize: 54, lineHeight: 1.15, fontWeight: 700 }}>
            <div style={{ display: "flex" }}>Scan to punch in</div>
            <div style={{ display: "flex" }}>at the office</div>
          </div>
          <div style={{ display: "flex", fontSize: 26, color: MUTED, lineHeight: 1.4 }}>
            {guarded
              ? "Sign in first. The punch is accepted only from the office network."
              : "Sign in first, then the scan punches you in for the day."}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 10,
              padding: "12px 20px",
              background: CARD,
              border: `1px solid ${PRIMARY}`,
              fontSize: 20,
              color: FG,
              whiteSpace: "nowrap",
            }}
          >
            {url}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 18,
            width: 520,
            background: CARD,
          }}
        >
          <img src={qr} width={400} height={400} alt="" style={{ background: "#ffffff", padding: 18 }} />
          <div style={{ display: "flex", fontSize: 22, color: MUTED }}>
            Questions? {LEAVE_MAIL.to}
          </div>
        </div>
        </div>
      </div>
    ),
    size
  );
}
