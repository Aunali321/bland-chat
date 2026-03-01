FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lock .npmrc ./
RUN bun install --frozen-lockfile

COPY . .
RUN mkdir -p /app/data && bun run build

FROM oven/bun:1-slim AS runtime

WORKDIR /app

COPY --from=builder /app/build ./build
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/package.json ./package.json

RUN mkdir -p /app/data

ENV HOST=0.0.0.0 \
    PORT=3000 \
    DATABASE_PATH=/app/data/bland-chat.sqlite

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD bun -e "const r = await fetch('http://localhost:' + (process.env.PORT ?? 3000)); process.exit(r.ok ? 0 : 1)"

CMD ["bun", "run", "build/index.js"]
