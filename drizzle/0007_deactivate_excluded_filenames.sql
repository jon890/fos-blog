-- Deactivate posts that were synced before EXCLUDED_FILENAMES policy was added.
-- Idempotent — only touches is_active=1 rows whose path basename is an EXCLUDED filename.
UPDATE posts
SET is_active = 0
WHERE is_active = 1
  AND UPPER(SUBSTRING_INDEX(path, '/', -1)) IN (
    'README.MD',
    'AGENTS.MD',
    'CLAUDE.MD',
    'GEMINI.MD',
    'COPILOT.MD',
    'CURSOR.MD',
    'CODERABBIT.MD',
    'CODY.MD'
  );
