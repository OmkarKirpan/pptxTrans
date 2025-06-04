.PHONY: help build run test test-coverage lint clean docker-build docker-run docs generate-mocks dev

# Variables
BINARY_NAME=audit-service
DOCKER_IMAGE=audit-service:latest
GO=go
GOFLAGS=-v
LDFLAGS=-w -s

# Default target
help:
	@echo "Available commands:"
	@echo "  make build          - Build the binary"
	@echo "  make run           - Run the application locally"
	@echo "  make dev           - Run the application in development mode (without building)"
	@echo "  make test          - Run unit tests"
	@echo "  make test-coverage - Run tests with coverage"
	@echo "  make lint          - Run linter"
	@echo "  make docs          - Generate OpenAPI documentation"
	@echo "  make generate-mocks - Generate mocks for testing"
	@echo "  make docker-build  - Build Docker image"
	@echo "  make docker-run    - Run in Docker"
	@echo "  make clean         - Clean build artifacts"

# Build the binary
build: docs
	@echo "Building $(BINARY_NAME)..."
	$(GO) build $(GOFLAGS) -ldflags="$(LDFLAGS)" -o bin/$(BINARY_NAME) cmd/server/main.go

# Run the application locally
run: build
	@echo "Running $(BINARY_NAME)..."
	./bin/$(BINARY_NAME)

# Run the application in development mode (without building)
dev:
	@echo "Running $(BINARY_NAME) in development mode..."
	cd cmd/server && $(GO) run main.go

# Run unit tests
test:
	@echo "Running tests..."
	$(GO) test $(GOFLAGS) ./...

# Run tests with coverage
test-coverage:
	@echo "Running tests with coverage..."
	$(GO) test $(GOFLAGS) -coverprofile=coverage.out ./...
	$(GO) tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report generated: coverage.html"

# Run linter
lint:
	@echo "Running linter..."
	golangci-lint run ./...

# Generate OpenAPI documentation
docs:
	@echo "Generating OpenAPI documentation..."
	swag init -g cmd/server/main.go -o docs

# Generate mocks for testing
generate-mocks:
	@echo "Generating mocks..."
	mockery --all
	@echo "Mocks generated successfully"

# Build Docker image
docker-build:
	@echo "Building Docker image..."
	docker build -t $(DOCKER_IMAGE) .

# Run in Docker
docker-run:
	@echo "Running in Docker..."
	docker run --rm -p 4006:4006 --env-file .env $(DOCKER_IMAGE)

# Clean build artifacts
clean:
	@echo "Cleaning..."
	rm -rf bin/
	rm -f coverage.out coverage.html
	rm -rf docs/
	rm -rf mocks/ 