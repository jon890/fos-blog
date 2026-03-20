import { ImageResponse } from "next/og";
import { getDbQueries } from "@/db/queries";
import { extractTitle } from "@/lib/markdown";

export const alt = "FOS Study";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function OGImage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug.map(decodeURIComponent).join("/");

  const dbQueries = getDbQueries();
  const data = dbQueries ? await dbQueries.getPost(slug) : null;

  const title = data
    ? extractTitle(data.content) || data.post.title
    : "FOS Study";
  const category = data?.post.category ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
          fontFamily: "sans-serif",
          padding: "60px 80px",
        }}
      >
        {/* Top: site name */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            color: "#94a3b8",
            fontSize: 28,
          }}
        >
          <span style={{ fontSize: 36 }}>📚</span>
          <span>FOS Study</span>
          {category && (
            <>
              <span style={{ color: "#475569" }}>›</span>
              <span
                style={{
                  background: "rgba(59,130,246,0.2)",
                  color: "#60a5fa",
                  padding: "4px 16px",
                  borderRadius: 20,
                  fontSize: 24,
                }}
              >
                {category}
              </span>
            </>
          )}
        </div>

        {/* Middle: post title */}
        <div
          style={{
            fontSize: title.length > 40 ? 52 : 64,
            fontWeight: 700,
            color: "white",
            lineHeight: 1.3,
            maxWidth: "90%",
          }}
        >
          {title}
        </div>

        {/* Bottom: domain */}
        <div
          style={{
            color: "#475569",
            fontSize: 24,
          }}
        >
          fosworld.co.kr
        </div>
      </div>
    ),
    { ...size }
  );
}
