import { ImageResponse } from "next/og";
import { createThumbnailPattern } from "@/lib/thumbnail-fallback";

export const runtime = "nodejs";
export const revalidate = 86_400;

const WIDTH = 1200;
const HEIGHT = 675;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ category: string }> },
) {
  const { category: encodedCategory } = await params;
  const category = decodeURIComponent(encodedCategory);
  const pattern = createThumbnailPattern(category);
  const accent = `hsl(${pattern.hue} 68% 62%)`;
  const secondary = `hsl(${(pattern.hue + 54) % 360} 72% 58%)`;
  const accentSoft = `hsla(${pattern.hue}, 68%, 62%, 0.33)`;
  const accentFaint = `hsla(${pattern.hue}, 68%, 62%, 0.14)`;
  const secondarySoft = `hsla(${(pattern.hue + 54) % 360}, 72%, 58%, 0.22)`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#050b16",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: -180,
            display: "flex",
            background: `radial-gradient(circle at 32% 44%, ${accentSoft} 0, transparent 34%), radial-gradient(circle at 76% 30%, ${secondarySoft} 0, transparent 28%)`,
            transform: `rotate(${pattern.rotation}deg)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 150,
            top: 95,
            width: 900,
            height: 485,
            display: "flex",
            border: `2px solid ${accentSoft}`,
            borderRadius: 72,
            transform: `rotate(${pattern.rotation / 3}deg)`,
            boxShadow: `0 0 90px ${accentSoft} inset, 0 0 60px ${accentFaint}`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 430,
            top: 168,
            width: 340,
            height: 340,
            display: "flex",
            border: `10px solid ${accent}`,
            borderRadius: "50%",
            boxShadow: `0 0 90px ${accentSoft}, 0 0 35px ${secondarySoft} inset`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 535,
            top: 273,
            width: 130,
            height: 130,
            display: "flex",
            background: accent,
            borderRadius: 32,
            transform: `rotate(${45 + pattern.rotation}deg)`,
            boxShadow: `0 0 70px ${accent}`,
          }}
        />
        {pattern.nodes.map((node, index) => (
          <div
            key={index}
            style={{
              position: "absolute",
              left: `${node.left}%`,
              top: `${node.top}%`,
              width: node.size,
              height: node.size,
              display: "flex",
              border: `3px solid ${index % 2 === 0 ? accent : secondary}`,
              borderRadius: index % 3 === 0 ? 18 : "50%",
              opacity: node.opacity,
              transform: `rotate(${pattern.rotation + index * 17}deg)`,
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background: "linear-gradient(115deg, rgba(5, 11, 22, 0.08), rgba(5, 11, 22, 0.78))",
          }}
        />
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      headers: {
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    },
  );
}
