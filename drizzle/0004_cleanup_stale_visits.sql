-- ADR-015: visit_logs / visit_stats 에 누적된 비유효 path row cleanup.
-- 활성/비활성 무관 posts.path 에 매치되는 row 는 보존 (비활성 글 visit 도 보존).
-- 홈 ('/') 도 보존.

DELETE FROM visit_logs
WHERE page_path <> '/'
  AND page_path NOT IN (SELECT path FROM posts);
--> statement-breakpoint
DELETE FROM visit_stats
WHERE page_path <> '/'
  AND page_path NOT IN (SELECT path FROM posts);
