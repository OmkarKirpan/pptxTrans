FROM oven/bun:1 as base
WORKDIR /app

# Install dependencies
COPY package.json .
COPY bun.lock .
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Build
RUN bun run build

# Start production image
FROM oven/bun:1-slim
WORKDIR /app

# Copy from build image
COPY --from=base /app/dist /app/dist
COPY --from=base /app/package.json /app

# Copy .env file if it exists (for Docker environment)
COPY --from=base /app/.env* ./

# Install production dependencies
RUN bun install --production --frozen-lockfile

# Set environment variables
ENV PORT=3001
ENV NODE_ENV=production

# Expose port
EXPOSE 3001

# Start server
CMD ["bun", "dist/index.js"] 