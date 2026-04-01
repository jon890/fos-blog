<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-20 | Updated: 2026-04-01 -->

# app/api/comments/[id]

## Purpose
Dynamic route for individual comment operations — update (`PUT`) and delete (`DELETE`) by comment ID. Both operations require password verification.

## Key Files

| File | Description |
|------|-------------|
| `route.ts` | `PUT` — update comment content after bcrypt password check; `DELETE` — remove comment after bcrypt password check |

## For AI Agents

### Working In This Directory
- `params.id` is a string; parse with `parseInt(id, 10)` — returns `400` if `NaN`
- In Next.js App Router, `params` is a `Promise` — must `await params` before destructuring
- Password mismatch throws an `Error` with message "비밀번호가 일치하지 않습니다." — caught and returned as `403`

### Common Patterns
```ts
const { id } = await params;
const commentId = parseInt(id, 10);
```

## Dependencies

### Internal
- `@/infra/db/repositories/CommentRepository` → `updateComment(id, password, content)`, `deleteComment(id, password)`

<!-- MANUAL: -->
