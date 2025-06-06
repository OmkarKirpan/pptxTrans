FROM oven/bun:1 as base
WORKDIR /app

# Install dependencies
COPY package.json .
COPY bun.lock .
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Build if there's a build script, otherwise just prepare
RUN if [ -f "package.json" ] && grep -q '"build"' package.json; then bun run build; fi

# Start production image
FROM oven/bun:1-slim
WORKDIR /app

# Copy application files
COPY --from=base /app/src /app/src
COPY --from=base /app/package.json /app

# Copy .env file if it exists (for Docker environment)
COPY --from=base /app/.env* ./

# Install production dependencies
RUN bun install --production --frozen-lockfile

# Set environment variables
ENV PORT=3002
ENV NODE_ENV=production

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3002/health || exit 1

# Start server
CMD ["bun", "src/index.js"] 