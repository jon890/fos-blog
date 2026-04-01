<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-20 | Updated: 2026-03-20 -->

# app/api/comments

## Purpose
API routes for blog post comments — list, create, update, and delete. Comments are identified by `postSlug` and protected by a user-provided password (bcrypt-hashed).

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `[id]/` | PUT (update) and DELETE by comment ID — see `[id]/AGENTS.md` |

## Key Files

| File | Description |
|------|-------------|
| `route.ts` | `GET ?slug=<postSlug>` — list comments; `POST` — create comment (requires nickname, password ≥4 chars, content ≤5000 chars) |
| `[id]/route.ts` | `PUT /[id]` — update comment (password-verified); `DELETE /[id]` — delete comment (password-verified) |

## For AI Agents

### Working In This Directory
- Comments use `postSlug` (the post's URL path, e.g. `devops/monitoring/foo.md`), **not** `postId`
- Password verification is done in the repository layer via bcrypt — `403` is returned on mismatch
- DB 접근은 `@/services/` 또는 repository를 통해 수행한다
- No authentication required for reading; write operations require the user's own comment password

### API Contract
```
GET  /api/comments?slug=<postSlug>
  → 200: { comments: Comment[] }

POST /api/comments
  Body: { postSlug, nickname, password, content }
  → 201: { comment }
  → 400: validation error

PUT  /api/comments/:id
  Body: { password, content }
  → 200: { comment }
  → 403: wrong password

DELETE /api/comments/:id
  Body: { password }
  → 200: { success: true }
  → 403: wrong password
```

## Dependencies

### Internal
- `@/infra/db/repositories/CommentRepository` → `getCommentsByPostSlug()`, `createComment()`, `updateComment()`, `deleteComment()`

<!-- MANUAL: -->
