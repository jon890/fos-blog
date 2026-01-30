import { NextResponse } from "next/server";

export async function GET() {
  const adsenseId = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ID;

  if (!adsenseId) {
    return new NextResponse("# ads.txt not configured", {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }

  // ca-pub-XXXXXXXXXXXXXXXX에서 pub ID 추출
  const pubId = adsenseId.replace("ca-pub-", "");

  const adsTxt = `google.com, pub-${pubId}, DIRECT, f08c47fec0942fa0`;

  return new NextResponse(adsTxt, {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=86400", // 24시간 캐시
    },
  });
}
