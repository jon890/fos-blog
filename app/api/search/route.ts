import { NextRequest, NextResponse } from "next/server";
import { searchPosts } from "@/lib/data";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q") || "";
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  if (!query.trim()) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchPosts(query, limit);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { results: [], error: "Search failed" },
      { status: 500 }
    );
  }
}
