# syntax=docker/dockerfile:1

# Pin the runtime version so local and CI containers use the same Node release.
FROM node:24.4.1-bookworm-slim

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4173 \
    DATABASE_PATH=/app/data/edge.db

WORKDIR /app

# Install production dependencies from the lockfile for reproducible builds.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=node:node public ./public
COPY --chown=node:node src ./src

# SQLite needs one writable directory; application code remains read-only.
RUN mkdir -p /app/data && chown node:node /app/data

USER node

EXPOSE 4173
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:4173/api/bets').then(response => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"]

CMD ["node", "src/server.js"]
