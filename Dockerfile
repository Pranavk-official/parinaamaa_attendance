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
CMD ["sh", "-c", "bunx prisma migrate deploy && bun prisma/seed.ts && bun run dev -- --hostname 0.0.0.0"]

# ---- builder ----
FROM deps AS builder
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
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./
EXPOSE 3000
CMD ["sh", "-c", "bunx prisma migrate deploy && bun prisma/seed.ts && bun run start"]