# Stage 1: base
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
RUN npm install -g pnpm@11.24.0
WORKDIR /app

# Stage 2: install + build
FROM base AS builder
COPY . .
RUN pnpm install --frozen-lockfile
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm db:generate

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN : "${NEXT_PUBLIC_SUPABASE_URL:?Set a Supabase project URL}" \
      "${NEXT_PUBLIC_SUPABASE_ANON_KEY:?Set a Supabase publishable key}" \
  && DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?connect_timeout=2 \
     NEXTAUTH_SECRET=docker-build-placeholder-not-for-runtime \
     FOOTBALL_DATA_API_KEY=docker-build-placeholder \
     pnpm --filter @app/web build

# Stage 3: runner (production)
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r => { if (!r.ok) process.exitCode = 1 }, () => { process.exitCode = 1 })"]
CMD ["node", "apps/web/server.js"]
