<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-17 | Updated: 2026-03-30 -->

# docker

## Purpose
Docker configuration for local development database. Contains MySQL initialization scripts used when starting the database container via `docker-compose.yml` at the project root.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `mysql/` | MySQL-specific init scripts run on first container startup (see `mysql/AGENTS.md`) |

## Key Files

| File | Description |
|------|-------------|
| `mysql/init.sql` | SQL script that creates the `posts`, `categories`, `folders`, and `sync_logs` tables, adds indexes, and inserts sample category data |

## For AI Agents

### Working In This Directory
- `init.sql` runs **only on first container startup** (when the data volume is empty) — changes require `pnpm db:down && docker volume prune` to take effect
- The canonical schema source of truth is `db/schema.ts` (Drizzle) — keep `init.sql` in sync when making schema changes
- To apply schema changes in development, prefer `pnpm db:push` over editing `init.sql` directly

### Common Patterns
```bash
# Start the MySQL container
pnpm db:up

# Stop and remove (data persists in Docker volume)
pnpm db:down

# Nuke data and reinitialize from init.sql
docker-compose down -v && pnpm db:up
```

## Dependencies

### External
- Docker and Docker Compose must be installed locally

<!-- MANUAL: -->
