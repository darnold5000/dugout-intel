# syntax=docker/dockerfile:1

# ---- Base ----
FROM node:20-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- Dependencies ----
FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

# ---- Builder ----
FROM base AS builder
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# Fail fast if Supabase URL is duplicated or malformed at build time
RUN node -e "\
  const u=process.env.NEXT_PUBLIC_SUPABASE_URL||'';\
  const count=(u.match(/supabase\\.co/gi)||[]).length;\
  if(!u||count!==1||!/^https:\\/\\/[a-z0-9-]+\\.supabase\\.co\\/?\$/.test(u.replace(/\\/+$/,'')){\
    console.error('Invalid NEXT_PUBLIC_SUPABASE_URL at build:',u);\
    process.exit(1);\
  }"

RUN npm run build

# ---- Runner ----
FROM base AS runner
ENV NODE_ENV=production
# Cloud Run sets PORT; default matches Cloud Run convention.
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 8080

# Standalone server.js reads process.env.PORT and binds to 0.0.0.0
CMD ["node", "server.js"]
