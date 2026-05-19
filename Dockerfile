# ── Stage 1: install dependencies ────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

# Non-root user for security
RUN addgroup -S horizon && adduser -S horizon -G horizon

# Copy deps and source
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Remove dev/build artifacts that don't belong in the image
RUN rm -rf .playwright-mcp .git .claude "Skills Horizon" "Skills Juanpe" \
    *.png files Identidad CLAUDE_HORIZON_2026.md

USER horizon

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server.js"]
