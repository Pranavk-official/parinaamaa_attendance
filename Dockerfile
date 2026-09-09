# ---- base ----
FROM oven/bun:1 AS base
WORKDIR /app

# ---- deps ----
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---- dev ----
FROM deps AS dev
COPY . .
EXPOSE 3000
ENV NODE_ENV=development
CMD ["sh", "-c", "bunx prisma generate && bunx prisma migrate deploy && bun prisma/seed.ts && bun run dev -- --hostname 0.0.0.0"]

# ---- builder ----
FROM deps AS builder
# Absolute URLs in metadata (og:image) are resolved when the static pages are
# built, so the origin has to be known here, not just at runtime.
ARG BETTER_AUTH_URL
ENV BETTER_AUTH_URL=$BETTER_AUTH_URL
COPY . .
RUN bunx prisma generate
RUN bun run build

# ---- prod ----
FROM base AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma7.config.ts ./
# The seeder imports src/lib/auth and src/lib/fiscal, and resolves "@/" through
# tsconfig, so the whole of src has to come along, not just the generated client.
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./
EXPOSE 3000
CMD ["sh", "-c", "bunx prisma migrate deploy && bun prisma/seed.prod.ts && bun run start"]