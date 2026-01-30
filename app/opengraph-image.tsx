import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "FOS Study - 개발 학습 블로그";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* Logo */}
        <div
          style={{
            fontSize: 120,
            marginBottom: 20,
          }}
        >
          📚
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: "white",
            marginBottom: 16,
          }}
        >
          FOS Study
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 32,
            color: "#94a3b8",
          }}
        >
          개발 학습 블로그
        </div>

        {/* Tags */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 40,
          }}
        >
          {["Java", "JavaScript", "React", "Spring", "DevOps"].map((tag) => (
            <div
              key={tag}
              style={{
                background: "rgba(59, 130, 246, 0.3)",
                color: "#60a5fa",
                padding: "8px 20px",
                borderRadius: 20,
                fontSize: 20,
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
