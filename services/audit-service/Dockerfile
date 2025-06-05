# Build stage
FROM golang:1.23-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git make

# Set working directory
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o audit-service cmd/server/main.go

# Final stage
FROM alpine:latest

# Install ca-certificates for HTTPS
RUN apk --no-cache add ca-certificates

# Create non-root user
RUN addgroup -g 1000 -S audit && \
    adduser -u 1000 -S audit -G audit

# Set working directory
WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/audit-service .

# Change ownership
RUN chown -R audit:audit /app

# Switch to non-root user
USER audit

# Expose port
EXPOSE 4006

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:4006/health || exit 1

# Run the application
ENTRYPOINT ["./audit-service"] 