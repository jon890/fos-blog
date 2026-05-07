import { formatRelativeTime } from "@/lib/format-time";

interface SiteStatsProps {
  postCount: number;
  categoryCount: number;
  lastSyncAt: Date | null;
}

export function SiteStats({ postCount, categoryCount, lastSyncAt }: SiteStatsProps) {
  return (
    <div className="ab-stats">
      <div className="ab-card ab-stat">
        <div className="ab-stat-eyebrow">
          <span>POSTS</span>
          <span className="right">total</span>
        </div>
        <div className="ab-stat-num">
          {postCount}
          <span className="unit">posts</span>
        </div>
        <div className="ab-stat-sub">{categoryCount} categories</div>
      </div>

      <div className="ab-card ab-stat">
        <div className="ab-stat-eyebrow">
          <span>CATEGORIES</span>
          <span className="right">active</span>
        </div>
        <div className="ab-stat-num">
          {categoryCount}
          <span className="unit">paths</span>
        </div>
        <div className="ab-stat-sub">distinct category</div>
      </div>

      <div className="ab-card ab-stat">
        <div className="ab-stat-eyebrow">
          <span>LAST SYNC</span>
          <span className="right">db</span>
        </div>
        <div className="ab-stat-num">
          {lastSyncAt ? formatRelativeTime(lastSyncAt) : "—"}
        </div>
        <div className="ab-stat-sub">
          <span className="pulse" />
          <span>
            {lastSyncAt
              ? new Date(lastSyncAt).toISOString().slice(0, 10)
              : "no sync yet"}
          </span>
        </div>
      </div>
    </div>
  );
}
