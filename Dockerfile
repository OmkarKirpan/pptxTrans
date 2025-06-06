FROM oven/bun:1 as builder

WORKDIR /app

# Copy package files for dependency installation
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy the rest of the app
COPY . .

# Build the Next.js app
RUN bun run build

# Production stage
FROM oven/bun:1-slim

WORKDIR /app

# Copy built app from builder stage
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Expose the port the app will run on
EXPOSE 3000

# Start the app
CMD ["bun", "start"] 