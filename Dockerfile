# Stage 1: Build everything
FROM node:18-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci && npm cache clean --force

COPY src ./src
COPY frontend ./frontend
COPY tsconfig.json vite.config.js tsup.config.ts ./

RUN npm run build

# Stage 2: Production (no node_modules)
FROM node:18-slim AS production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --gid 1001 nodejs

WORKDIR /app

# Copy only the bundle and frontend assets
COPY --from=builder /app/dist/index.js ./dist/index.js
COPY --from=builder /app/dist/frontend ./dist/frontend

RUN chown -R nodejs:nodejs /app

USER nodejs

ENV NODE_ENV=production
ENV PORT=41520
ENV HOST=0.0.0.0

EXPOSE 41520

CMD ["node", "dist/index.js"]

LABEL org.opencontainers.image.source="https://github.com/IGoRFonin/excalidecks"
LABEL org.opencontainers.image.description="Excalidecks - Excalidraw canvas presentations and live MCP drawing server"
LABEL org.opencontainers.image.licenses="MIT"
