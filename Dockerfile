# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY . .

# Ensure public directory exists
RUN mkdir -p public

# Build arguments for environment variables
ARG GITHUB_TOKEN
ARG GITHUB_OWNER=jon890
ARG GITHUB_REPO=fos-study
ARG NEXT_PUBLIC_SITE_URL=https://blog.fosworld.co.kr

# Set environment variables for build
ENV GITHUB_TOKEN=${GITHUB_TOKEN}
ENV GITHUB_OWNER=${GITHUB_OWNER}
ENV GITHUB_REPO=${GITHUB_REPO}
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_TELEMETRY_DISABLED=1
# 빌드 시 env 검증 스킵 — 런타임에 실제 env로 검증됨
ENV SKIP_ENV_VALIDATION=true

# Build the application
RUN pnpm build

# Bundle migrate script with all deps inlined (Next.js standalone tracer
# does not include drizzle-orm/mysql2 as standalone require()-able packages,
# so we ship migrate.js as a self-contained bundle).
RUN pnpm exec ncc build scripts/migrate.ts -o dist -m

# Production stage
FROM node:22-alpine AS runner

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy migration script and artifacts
COPY --from=builder --chown=nextjs:nodejs /app/dist/index.js ./migrate.js
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "node migrate.js && node server.js"]
