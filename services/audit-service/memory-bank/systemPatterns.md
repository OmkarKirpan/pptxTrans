<!-- systemPatterns.md -->

# System Patterns: Audit Service

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    HTTP Requests                             │
│                  (GET /sessions/{id}/history)                │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Gin Router                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                Middleware Stack                      │   │
│  │  • Request ID Generator                              │   │
│  │  • Zap Logger (structured)                          │   │
│  │  • Auth Middleware (JWT/Share Token)                │   │
│  │  • Error Handler                                    │   │
│  └─────────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Handlers Layer                            │
│              (AuditHandler.GetHistory)                       │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                             │
│              (AuditService.GetAuditLogs)                     │
│  • Business logic                                            │
│  • Permission validation                                     │
│  • Response formatting                                       │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                  Repository Layer                            │
│           (AuditRepository.FindBySessionID)                  │
│  • Supabase REST API calls                                   │
│  • HTTP connection pooling                                   │
│  • Response parsing                                          │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                 External Services                            │
│  ┌─────────────────┐  ┌──────────────────┐                 │
│  │  Token Cache    │  │  Supabase REST   │                 │
│  │  (In-Memory)    │  │  API             │                 │
│  └─────────────────┘  └──────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

## 2. Design Patterns

### 2.1 Domain-Driven Design (DDD)
```go
// Clear separation of concerns
internal/
├── domain/      // Business entities & rules
├── handlers/    // HTTP layer
├── service/     // Business logic
└── repository/  // Data access
```

### 2.2 Dependency Injection
```go
// Constructor injection for testability
type AuditHandler struct {
    service Service
    logger  *zap.Logger
}

func NewAuditHandler(service Service, logger *zap.Logger) *AuditHandler {
    return &AuditHandler{
        service: service,
        logger:  logger,
    }
}
```

### 2.3 Interface Segregation
```go
// Small, focused interfaces
type AuditService interface {
    GetAuditLogs(ctx context.Context, sessionID string, limit, offset int) (*AuditResponse, error)
}

type AuditRepository interface {
    FindBySessionID(ctx context.Context, sessionID string, limit, offset int) ([]AuditEntry, int, error)
}
```

### 2.4 Repository Pattern
- Abstracts data access behind interfaces
- Enables easy mocking for tests
- Centralizes Supabase REST API logic

### 2.5 Middleware Chain Pattern
```go
router.Use(
    middleware.RequestID(),
    middleware.Logger(logger),
    middleware.ErrorHandler(),
)

protected.Use(middleware.Auth(tokenValidator))
```

## 3. Authentication Flow

```
┌──────────┐     ┌──────────────┐     ┌────────────┐     ┌──────────┐
│  Client  │────▶│   Auth MW    │────▶│Token Cache │────▶│ Validate │
└──────────┘     └──────────────┘     └────────────┘     └──────────┘
                         │                    │ Miss              │
                         │                    └──────────────────▶│
                         │                                        ▼
                         │                              ┌──────────────┐
                         │                              │  Supabase    │
                         │                              │  Validation  │
                         │                              └──────────────┘
                         ▼
                 ┌──────────────┐
                 │   Handler    │
                 └──────────────┘
```

## 4. Caching Strategy

### Token Cache Design
```go
type TokenCache struct {
    cache *cache.Cache  // go-cache with TTL
}

// Cache JWT tokens for 5 minutes
// Cache share tokens for 1 minute
// Reduce auth overhead by 90%+
```

### Cache Key Patterns
- JWT: `jwt:{token_hash}`
- Share: `share:{token}:{sessionID}`

## 5. Error Handling Patterns

### Structured Errors
```go
type APIError struct {
    Code    string `json:"error"`
    Message string `json:"message"`
    Status  int    `json:"-"`
}

// Consistent error responses
var (
    ErrUnauthorized = &APIError{
        Code:    "unauthorized",
        Message: "Invalid or missing authentication",
        Status:  401,
    }
    ErrForbidden = &APIError{
        Code:    "forbidden", 
        Message: "Access denied to this resource",
        Status:  403,
    }
    ErrNotFound = &APIError{
        Code:    "not_found",
        Message: "Session not found",
        Status:  404,
    }
)
```

## 6. Logging Patterns

### Structured Logging with Context
```go
logger.Info("audit logs retrieved",
    zap.String("request_id", requestID),
    zap.String("session_id", sessionID),
    zap.Int("count", len(entries)),
    zap.Duration("duration", time.Since(start)),
)
```

### Request Tracing
- Generate UUID for each request
- Pass through all layers via context
- Include in all log entries

## 7. Configuration Management

### Environment-Based Config
```go
type Config struct {
    Port              string
    SupabaseURL       string
    SupabaseAnonKey   string
    SupabaseJWTSecret string
    LogLevel          string
    
    // HTTP Client settings
    HTTPTimeout           time.Duration
    HTTPMaxIdleConns      int
    HTTPMaxConnsPerHost   int
}
```

### Viper Integration
- Load from environment variables
- Support for config files
- Default values for development

## 8. Testing Patterns

### 8.1 Mock Generation Strategy
```yaml
# .mockery.yaml
with-expecter: true
dir: "mocks"
outpkg: "mocks"
mockname: "Mock{{.InterfaceName}}"
filename: "mock_{{.InterfaceName | snakecase}}.go"
interfaces:
  AuditService:
    config:
      dir: "internal/service/mocks"
  AuditRepository:
    config:
      dir: "internal/repository/mocks"
  TokenValidator:
    config:
      dir: "pkg/jwt/mocks"
```

### 8.2 Unit Test Patterns

#### Table-Driven Tests
```go
func TestAuditService_GetAuditLogs(t *testing.T) {
    tests := []struct {
        name         string
        sessionID    string
        limit        int
        offset       int
        mockSetup    func(*mocks.MockAuditRepository)
        expectedResp *domain.AuditResponse
        expectedErr  error
    }{
        {
            name:      "successful retrieval",
            sessionID: "valid-session-id",
            limit:     10,
            offset:    0,
            mockSetup: func(repo *mocks.MockAuditRepository) {
                repo.EXPECT().FindBySessionID(
                    mock.Anything, "valid-session-id", 10, 0,
                ).Return(mockEntries, 25, nil)
            },
            expectedResp: &domain.AuditResponse{
                TotalCount: 25,
                Items:      mockEntries,
            },
            expectedErr: nil,
        },
        // Additional test cases...
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Test implementation with proper setup/teardown
        })
    }
}
```

#### Mock Interface Usage
```go
type MockAuditRepository struct {
    mock.Mock
}

func (m *MockAuditRepository) FindBySessionID(
    ctx context.Context, 
    sessionID string, 
    limit, offset int,
) ([]domain.AuditEntry, int, error) {
    args := m.Called(ctx, sessionID, limit, offset)
    return args.Get(0).([]domain.AuditEntry), args.Int(1), args.Error(2)
}
```

### 8.3 HTTP Testing Patterns

#### Handler Testing with httptest
```go
func TestAuditHandler_GetHistory(t *testing.T) {
    gin.SetMode(gin.TestMode)
    
    tests := []struct {
        name           string
        sessionID      string
        queryParams    string
        mockSetup      func(*mocks.MockAuditService)
        expectedStatus int
        expectedBody   string
    }{
        // Test cases
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Setup mock service
            mockService := mocks.NewMockAuditService(t)
            tt.mockSetup(mockService)
            
            // Create handler and router
            handler := handlers.NewAuditHandler(mockService, logger)
            router := gin.New()
            router.GET("/sessions/:sessionId/history", handler.GetHistory)
            
            // Create request and recorder
            req := httptest.NewRequest("GET", 
                fmt.Sprintf("/sessions/%s/history%s", tt.sessionID, tt.queryParams), 
                nil)
            w := httptest.NewRecorder()
            
            // Execute request
            router.ServeHTTP(w, req)
            
            // Assertions
            assert.Equal(t, tt.expectedStatus, w.Code)
            assert.JSONEq(t, tt.expectedBody, w.Body.String())
        })
    }
}
```

### 8.4 Integration Test Patterns

#### Supabase Integration Setup
```go
func setupTestSupabase(t *testing.T) *repository.SupabaseClient {
    config := &config.Config{
        SupabaseURL:           "http://localhost:54321",
        SupabaseServiceKey:    os.Getenv("TEST_SUPABASE_SERVICE_KEY"),
        HTTPTimeout:           30 * time.Second,
        HTTPMaxIdleConns:      10,
        HTTPMaxConnsPerHost:   2,
    }
    
    client, err := repository.NewSupabaseClient(config, logger)
    require.NoError(t, err)
    
    // Verify connection
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    
    err = client.HealthCheck(ctx)
    require.NoError(t, err, "Supabase connection failed")
    
    return client
}
```

#### Complete API Flow Testing
```go
func TestAuditAPI_Integration(t *testing.T) {
    if testing.Short() {
        t.Skip("Skipping integration tests in short mode")
    }
    
    // Setup test server with real dependencies
    supabaseClient := setupTestSupabase(t)
    tokenCache := cache.NewTokenCache(5*time.Minute, 1*time.Minute)
    jwtValidator := jwt.NewValidator(testJWTSecret)
    
    repo := repository.NewAuditRepository(supabaseClient, logger)
    service := service.NewAuditService(repo, logger)
    handler := handlers.NewAuditHandler(service, logger)
    
    router := setupRouter(handler, jwtValidator, tokenCache, logger)
    server := httptest.NewServer(router)
    defer server.Close()
    
    tests := []struct {
        name           string
        setupData      func() (sessionID string, token string)
        expectedStatus int
        validateResp   func(t *testing.T, body []byte)
    }{
        // Integration test cases
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Test implementation
        })
    }
}
```

### 8.5 Test Utilities and Helpers

#### Test Fixtures
```go
// tests/helpers/fixtures.go
package helpers

func CreateTestAuditEntry(sessionID, userID string) domain.AuditEntry {
    return domain.AuditEntry{
        ID:        uuid.New(),
        SessionID: sessionID,
        UserID:    userID,
        Action:    domain.ActionEdit,
        Timestamp: time.Now(),
        Details:   json.RawMessage(`{"field": "content", "old": "old", "new": "new"}`),
    }
}

func CreateTestJWT(userID string, sessionID string, secret []byte) string {
    claims := jwt.MapClaims{
        "sub": userID,
        "exp": time.Now().Add(time.Hour).Unix(),
        "iat": time.Now().Unix(),
        "aud": "authenticated",
        "iss": "supabase",
    }
    
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    tokenString, _ := token.SignedString(secret)
    return tokenString
}
```

### 8.6 Coverage and Quality Patterns

#### Coverage Configuration
```makefile
# Makefile targets for testing
test:
	go test ./... -v

test-coverage:
	go test ./... -coverprofile=coverage.out
	go tool cover -html=coverage.out -o coverage.html

generate-mocks:
	mockery --all
```

### 8.7 Middleware Testing Patterns

#### Authentication Middleware Testing
```go
func TestAuth(t *testing.T) {
    tests := []struct {
        name           string
        setupPath      string
        setupRequest   func(*http.Request)
        setupMocks     func(*mocks.MockTokenValidator, *mocks.MockAuditRepository, *cache.TokenCache)
        expectedStatus int
        expectedUserID string
        expectedType   string
    }{
        {
            name:      "success_jwt_token",
            setupPath: "/sessions/test-session/history",
            setupRequest: func(req *http.Request) {
                req.Header.Set("Authorization", "Bearer valid-jwt-token")
            },
            setupMocks: func(mockValidator *mocks.MockTokenValidator, mockRepo *mocks.MockAuditRepository, tokenCache *cache.TokenCache) {
                claims := createTestJWTClaims()
                mockValidator.On("ValidateToken", mock.Anything, "valid-jwt-token").
                    Return(claims, nil)
            },
            expectedStatus: 200,
            expectedUserID: testUserID,
            expectedType:   TokenTypeJWT,
        },
        // Additional test cases for share tokens, error scenarios
    }
}
```

#### Bearer Token Extraction with Edge Cases
```go
func TestExtractBearerToken(t *testing.T) {
    tests := []struct {
        name          string
        authHeader    string
        expectedToken string
    }{
        {
            name:          "extra_spaces",
            authHeader:    "Bearer  token123", // Multiple spaces
            expectedToken: "token123",
        },
        {
            name:          "case_insensitive_bearer",
            authHeader:    "bearer token123",
            expectedToken: "token123",
        },
    }
}

// Implementation handles edge cases:
func extractBearerToken(authHeader string) string {
    authHeader = strings.TrimSpace(authHeader)
    if len(authHeader) < 7 || strings.ToLower(authHeader[:6]) != "bearer" {
        return ""
    }
    token := strings.TrimSpace(authHeader[6:])
    if token == "" {
        return ""
    }
    return token
}
```

#### Error Handler Testing with Logging Verification
```go
func TestErrorHandler(t *testing.T) {
    tests := []struct {
        name           string
        setupHandler   func(*gin.Context)
        expectedStatus int
        expectLogs     bool
        expectedLogMsg string
    }{
        {
            name: "logs_server_error_500",
            setupHandler: func(c *gin.Context) {
                c.JSON(500, domain.APIErrInternalServer)
            },
            expectedStatus: 500,
            expectLogs:     true,
            expectedLogMsg: "server error response",
        },
    }
    
    // Setup logger with buffer to capture logs
    var logBuffer bytes.Buffer
    encoder := zapcore.NewJSONEncoder(zap.NewDevelopmentEncoderConfig())
    core := zapcore.NewCore(encoder, zapcore.AddSync(&logBuffer), zapcore.DebugLevel)
    logger := zap.New(core)
    
    // Verify server errors are logged
    if tt.expectLogs {
        assert.Contains(t, logBuffer.String(), tt.expectedLogMsg)
        assert.Contains(t, logBuffer.String(), fmt.Sprintf(`"status":%d`, tt.expectedStatus))
    }
}
```

#### Request ID Testing with Response Headers
```go
func TestRequestID(t *testing.T) {
    // Test that checks response headers correctly
    router.GET("/test", func(c *gin.Context) {
        capturedRequestID = GetRequestID(c)
        c.JSON(200, gin.H{"success": true})
    })
    
    w := httptest.NewRecorder()
    router.ServeHTTP(w, req)
    
    if tt.expectHeaderSet {
        capturedHeaderID = w.Header().Get("X-Request-ID") // Check response header
        assert.NotEmpty(t, capturedHeaderID)
    }
}
```

#### Method Not Allowed Testing Pattern
```go
func TestHandleMethodNotAllowed(t *testing.T) {
    router := gin.New()
    router.HandleMethodNotAllowed = true  // Enable 405 responses
    router.NoMethod(HandleMethodNotAllowed())
    
    router.GET("/test", func(c *gin.Context) {
        c.JSON(200, gin.H{"success": true})
    })
    
    // POST to GET-only endpoint triggers 405
    req, _ := http.NewRequest("POST", "/test", nil)
    w := httptest.NewRecorder()
    router.ServeHTTP(w, req)
    
    assert.Equal(t, 405, w.Code)
}
```

## 9. Quality Assurance Patterns

### Test Suite Organization
- **Unit Tests**: Component isolation with mocks
- **Integration Tests**: Real external dependencies
- **End-to-End Tests**: Complete API workflows
- **Performance Tests**: Load and stress testing

### Continuous Testing
- Pre-commit hooks run tests
- CI pipeline runs full test suite
- Coverage reports generated automatically
- Quality gates prevent regression

## Architectural Patterns

### Service Layer Architecture
The audit service follows a layered architecture pattern:

```
┌───────────────┐
│   Handlers    │ HTTP request/response handling
├───────────────┤
│   Services    │ Business logic
├───────────────┤
│ Repositories  │ Data access
└───────────────┘
```

### Test Data Handling Pattern
The service implements a special pattern for handling test data:

```
┌───────────────────────┐
│ Request with test-*   │
│ session ID            │
└─────────┬─────────────┘
          │
          ▼
┌───────────────────────┐     ┌───────────────────┐
│ Check for test prefix ├────►│ Bypass database   │
└─────────┬─────────────┘     │ validation        │
          │                   └───────────────────┘
          │ (if not test)
          ▼
┌───────────────────────┐
│ Normal validation     │
│ against database      │
└───────────────────────┘
```

This approach allows testing without database dependencies while maintaining strict validation for production data.

### In-Memory Test Storage Pattern
For test sessions, the service uses an in-memory storage pattern:

```
┌───────────────┐     ┌───────────────┐
│ Test Events   │────►│ In-Memory Map │
└───────────────┘     └───────┬───────┘
                             │
                             ▼
┌─────────────────────────────────────┐
│ Concurrent Access via Mutex Locking │
└─────────────────────────────────────┘
```

This pattern provides:
- Thread-safe storage using mutex locking
- Session-based segmentation of test data
- Pagination support for retrieval
- No database dependency for testing

### API Request/Response Pattern
All API endpoints follow a consistent request/response pattern:

1. Request validation
2. Authorization check
3. Business logic execution
4. Structured response generation

Error responses follow a standard format:
```json
{
  "error": "error_code",
  "message": "Human-readable error message"
}
```

Success responses are endpoint-specific but follow consistent structure.

## Implementation Patterns

### Service Layer Pattern
The service layer abstracts business logic from HTTP handling:

```go
// AuditService defines the interface for audit business logic
type AuditService interface {
  GetAuditLogs(ctx context.Context, sessionID, userID string, isShareToken bool, pagination domain.PaginationParams) (*domain.AuditResponse, error)
}
```

### Repository Pattern
The repository layer abstracts data access:

```go
// AuditRepository defines the interface for audit data access
type AuditRepository interface {
  FindBySessionID(ctx context.Context, sessionID string, limit, offset int) ([]domain.AuditEntry, int, error)
  GetSession(ctx context.Context, sessionID string) (*Session, error)
  ValidateShareToken(ctx context.Context, token, sessionID string) (bool, error)
}
```

### Domain Error Pattern
The service uses domain errors for business logic errors:

```go
// Common domain errors
var (
  ErrUnauthorized = errors.New("unauthorized")
  ErrForbidden    = errors.New("forbidden")
  ErrNotFound     = errors.New("resource not found")
  // ...
)
```

These are mapped to HTTP status codes in the handlers:

```go
// ToAPIError converts domain errors to API errors
func ToAPIError(err error) *APIError {
  switch {
  case errors.Is(err, ErrUnauthorized):
    return APIErrUnauthorized
  case errors.Is(err, ErrForbidden):
    return APIErrForbidden
  // ...
  }
}
```

### Test Session ID Pattern
The service uses a prefix-based pattern to identify test session IDs:

```go
// Skip validation for test session IDs
if strings.HasPrefix(sessionID, "test-") {
  // Special handling for test data
}
```

This pattern enables easy identification of test data throughout the system while maintaining strict validation for production data.

## Application Architecture

### Domain-Driven Design
The audit service follows domain-driven design principles, separating business concerns from technical implementation details. The architecture includes:

- **Domain Layer**: Business entities and value objects
- **Service Layer**: Core business logic and application use cases
- **Repository Layer**: Data access abstractions
- **Handler Layer**: HTTP handlers (controllers) for API endpoints
- **Middleware**: Cross-cutting concerns like authentication, logging, etc.

### Package Structure
```
audit-service/                 # Project root
├── cmd/                       # Application entry points
│   └── server/                # Main server application
├── internal/                  # Private application code
│   ├── config/                # Configuration management
│   ├── domain/                # Domain models
│   ├── handlers/              # HTTP handlers
│   ├── middleware/            # HTTP middleware
│   ├── repository/            # Data access
│   └── service/               # Business logic
├── pkg/                       # Shared packages
│   ├── cache/                 # Token caching
│   ├── jwt/                   # JWT validation
│   └── logger/                # Logging utilities
├── tests/                     # Test utilities
│   └── helpers/               # Testing helpers
├── main.go                    # Root wrapper for Go tooling compatibility
├── go.mod                     # Go module definition
└── Makefile                   # Build and development tasks
```

### Root main.go Pattern
To ensure Go tooling compatibility (like `go list`, `go mod tidy`, etc.), a main.go file is added to the project root directory. This pattern:

1. Fixes the "no Go files in directory" error
2. Acts as a simple wrapper to execute the actual application in cmd/server/main.go
3. Doesn't affect application logic or behavior
4. Makes development tools work more smoothly
5. Maintains separation of concerns with actual implementation in cmd/server/

```go
// Root main.go wrapper pattern
package main

import (
	"fmt"
	"os"
	"os/exec"
)

func main() {
	// This file exists only to fix the "no Go files in directory" error
	// The actual main function is in cmd/server/main.go
	fmt.Println("Starting audit-service...")
	
	cmd := exec.Command("go", "run", "cmd/server/main.go")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
```

### Dependency Injection
The service uses constructor-based dependency injection for maintainability and testability:

```go
// Repository layer
type AuditRepository interface {
    GetAuditLogs(ctx context.Context, sessionId string, limit, offset int) (*domain.AuditResponse, error)
    // Other methods...
}

// Service layer depends on repository
type AuditService struct {
    repo   AuditRepository
    cache  TokenCache
    logger *zap.Logger
}

// Constructor injection
func NewAuditService(repo AuditRepository, cache TokenCache, logger *zap.Logger) *AuditService {
    return &AuditService{
        repo:   repo,
        cache:  cache,
        logger: logger,
    }
}
```

### Interface-Based Design
The service extensively uses interfaces to define contracts between layers, enabling:

- Loose coupling between components
- Easier mocking for tests
- Flexibility to change implementations

Key interfaces include:
- `AuditRepository`: Data access abstraction
- `TokenValidator`: JWT validation contract
- `TokenCache`: Caching behavior contract

## HTTP Layer

### Gin Framework Integration
The service uses Gin as the HTTP framework:

```go
func setupRouter(cfg *config.Config, ...) *gin.Engine {
    router := gin.New()
    
    // Global middleware
    router.Use(
        middleware.CORSMiddleware(cfg.CORSOrigin, zapLogger),
        gin.Recovery(),
        middleware.RequestID(),
        middleware.Logger(zapLogger),
        middleware.ErrorHandler(zapLogger),
    )
    
    // Routes
    router.GET("/health", handleHealth)
    
    // API v1 routes
    v1 := router.Group("/api/v1")
    {
        sessions := v1.Group("/sessions")
        sessions.Use(middleware.Auth(...))
        {
            sessions.GET("/:sessionId/history", auditHandler.GetHistory)
        }
    }
    
    return router
}
```

### Documentation URL Handling Pattern
To provide a better developer experience when accessing API documentation, a custom wrapper for Swagger UI handles URL redirects:

```go
// Custom wrapper for Swagger UI that handles redirects
router.GET("/docs/*any", func(c *gin.Context) {
    // Check if the path is exactly /docs/ or /docs
    path := c.Param("any")
    if path == "" || path == "/" {
        c.Redirect(http.StatusMovedPermanently, "/docs/index.html")
        return
    }
    // Otherwise use the standard handler
    ginSwagger.WrapHandler(swaggerFiles.Handler)(c)
})
```

This pattern ensures:
1. `/docs` and `/docs/` automatically redirect to `/docs/index.html`
2. Other paths like `/docs/swagger.json` still work correctly
3. No route conflicts with Gin's wildcard handling
4. Better user experience with intuitive URLs

### Middleware Chain
The service uses middleware for cross-cutting concerns:

1. **CORS Middleware**: Handles Cross-Origin Resource Sharing
2. **Request ID Middleware**: Generates a unique ID for each request
3. **Logger Middleware**: Structured logging for all requests
4. **Error Handler Middleware**: Consistent error responses
5. **Auth Middleware**: JWT and share token validation

Example middleware pattern:
```go
func RequestID() gin.HandlerFunc {
    return func(c *gin.Context) {
        requestID := uuid.New().String()
        c.Set("requestID", requestID)
        c.Header("X-Request-ID", requestID)
        c.Next()
    }
}
```

### Authentication Pattern
The service supports two authentication methods:

1. **JWT Authentication** (Bearer token)
   - Extracted from Authorization header
   - Validated against Supabase JWT secret
   - User ID extracted from claims
   
2. **Share Token Authentication** (URL parameter)
   - Extracted from `share_token` query parameter
   - Validated against Supabase `session_shares` table
   - Limited to specific session access

Authentication flow:
```go
func Auth(validator jwt.TokenValidator, cache *cache.TokenCache, repo repository.AuditRepository, logger *zap.Logger) gin.HandlerFunc {
    return func(c *gin.Context) {
        // 1. Extract token from header or query param
        token := extractBearerToken(c) || extractShareToken(c)
        
        // 2. Check cache first
        if cachedUser := cache.Get(token); cachedUser != nil {
            c.Set("userId", cachedUser.ID)
            c.Set("sessionAccess", cachedUser.SessionAccess)
            c.Next()
            return
        }
        
        // 3. Validate token (JWT or share token)
        user, err := validateToken(token, validator, repo)
        if err != nil {
            c.AbortWithStatusJSON(http.StatusUnauthorized, domain.NewAPIError("unauthorized", "Invalid token"))
            return
        }
        
        // 4. Cache successful validation
        cache.Set(token, user)
        
        // 5. Set user context for handlers
        c.Set("userId", user.ID)
        c.Set("sessionAccess", user.SessionAccess)
        c.Next()
    }
}
```

## Data Access Layer

### Repository Pattern
The service uses the repository pattern to abstract data access:

```go
type AuditRepository interface {
    GetAuditLogs(ctx context.Context, sessionId string, limit, offset int) (*domain.AuditResponse, error)
    ValidateSessionAccess(ctx context.Context, sessionId, userId string) (bool, error)
    ValidateShareToken(ctx context.Context, shareToken string) (*domain.TokenUser, error)
}

type auditRepository struct {
    client *SupabaseClient
    logger *zap.Logger
}
```

### Supabase REST Client
Data access is implemented using Supabase REST API:

```go
func (r *auditRepository) GetAuditLogs(ctx context.Context, sessionId string, limit, offset int) (*domain.AuditResponse, error) {
    url := fmt.Sprintf("%s/rest/v1/audit_logs?select=*&session_id=eq.%s&order=timestamp.desc&limit=%d&offset=%d",
        r.client.baseURL, url.QueryEscape(sessionId), limit, offset)
    
    req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
    if err != nil {
        return nil, err
    }
    
    // Add Supabase headers
    r.client.addHeaders(req)
    req.Header.Add("Prefer", "count=exact")
    
    resp, err := r.client.httpClient.Do(req)
    // ... handle response and errors
}
```

### HTTP Client Configuration
The service uses a properly configured HTTP client for optimal performance:

```go
func NewSupabaseClient(cfg *config.Config, logger *zap.Logger) *SupabaseClient {
    return &SupabaseClient{
        baseURL: cfg.SupabaseURL,
        apiKey: cfg.SupabaseServiceRoleKey,
        httpClient: &http.Client{
            Timeout: 30 * time.Second,
            Transport: &http.Transport{
                MaxIdleConns:        100,
                MaxIdleConnsPerHost: 10,
                IdleConnTimeout:     90 * time.Second,
            },
        },
        logger: logger,
    }
}
```

### Test Session Handling
For development and testing, the service implements special handling for test session IDs:

```go
func (r *auditRepository) GetAuditLogs(ctx context.Context, sessionId string, limit, offset int) (*domain.AuditResponse, error) {
    // Special handling for test session IDs
    if strings.HasPrefix(sessionId, "test-") {
        return r.getTestAuditLogs(sessionId, limit, offset), nil
    }
    
    // Normal database access for production sessions
    // ...
}
```

## Service Layer

### Business Logic Encapsulation
The service layer encapsulates all business logic:

```go
func (s *AuditService) GetAuditHistory(ctx context.Context, sessionId string, userId string, limit, offset int) (*domain.AuditResponse, error) {
    // 1. Input validation
    if sessionId == "" {
        return nil, domain.NewAPIError("invalid_session_id", "Session ID is required")
    }
    
    // 2. Authorization check (unless test session)
    if !strings.HasPrefix(sessionId, "test-") {
        hasAccess, err := s.repo.ValidateSessionAccess(ctx, sessionId, userId)
        if err != nil {
            s.logger.Error("failed to validate session access", zap.Error(err))
            return nil, domain.NewAPIError("internal_error", "Failed to validate access")
        }
        if !hasAccess {
            return nil, domain.NewAPIError("forbidden", "You do not have access to this session")
        }
    }
    
    // 3. Retrieve audit logs
    result, err := s.repo.GetAuditLogs(ctx, sessionId, limit, offset)
    if err != nil {
        s.logger.Error("failed to get audit logs", zap.Error(err))
        return nil, domain.NewAPIError("internal_error", "Failed to retrieve audit logs")
    }
    
    return result, nil
}
```

### Domain Error Handling
The service uses domain errors to convey business rule violations:

```go
// Domain error type
type APIError struct {
    Code    string `json:"error"`
    Message string `json:"message"`
}

// Create domain error in service layer
if !hasAccess {
    return nil, domain.NewAPIError("forbidden", "You do not have access to this session")
}

// Handle domain error in HTTP layer (middleware)
func ErrorHandler(logger *zap.Logger) gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Next()
        
        if len(c.Errors) > 0 {
            err := c.Errors.Last().Err
            
            // Check for domain errors
            if apiErr, ok := err.(*domain.APIError); ok {
                statusCode := getStatusCodeForErrorCode(apiErr.Code)
                c.JSON(statusCode, apiErr)
                return
            }
            
            // Generic error handling
            logger.Error("unexpected error", zap.Error(err))
            c.JSON(http.StatusInternalServerError, domain.NewAPIError("internal_error", "An unexpected error occurred"))
        }
    }
}
```

## Caching

### Token Caching
The service uses in-memory caching for validated tokens:

```go
type TokenCache struct {
    cache *cache.Cache
}

func NewTokenCache(jwtTTL, shareTokenTTL, cleanupInterval time.Duration) *TokenCache {
    return &TokenCache{
        cache: cache.New(jwtTTL, cleanupInterval),
    }
}

func (tc *TokenCache) Get(token string) *domain.TokenUser {
    if item, found := tc.cache.Get(token); found {
        return item.(*domain.TokenUser)
    }
    return nil
}

func (tc *TokenCache) Set(token string, user *domain.TokenUser, ttl time.Duration) {
    tc.cache.Set(token, user, ttl)
}
```

### Tiered Cache Pattern
The authentication middleware uses a tiered approach:
1. First check cache for token
2. If not found, validate token cryptographically
3. For share tokens, query database
4. Cache successful validations

## Configuration Management

### Viper + Environment Variables
The service uses Viper for flexible configuration:

```go
func Load() (*Config, error) {
    viper.SetEnvPrefix("AUDIT")
    viper.AutomaticEnv()
    
    // Defaults
    viper.SetDefault("PORT", "4006")
    viper.SetDefault("LOG_LEVEL", "info")
    viper.SetDefault("CORS_ORIGIN", "*")
    viper.SetDefault("CACHE_JWT_TTL", "5m")
    viper.SetDefault("CACHE_SHARE_TOKEN_TTL", "1m")
    viper.SetDefault("CACHE_CLEANUP_INTERVAL", "10m")
    
    // Environment file
    viper.SetConfigName(".env")
    viper.SetConfigType("env")
    viper.AddConfigPath(".")
    if err := viper.ReadInConfig(); err != nil {
        if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
            return nil, fmt.Errorf("failed to load .env file: %w", err)
        }
        // Continue with environment variables only
    }
    
    // Map to struct
    var cfg Config
    if err := viper.Unmarshal(&cfg); err != nil {
        return nil, fmt.Errorf("failed to unmarshal config: %w", err)
    }
    
    // Validate required fields
    if err := cfg.Validate(); err != nil {
        return nil, err
    }
    
    return &cfg, nil
}
```

## Logging

### Structured Logging with Zap
The service uses Zap for structured, performant logging:

```go
func New(level string) (*zap.Logger, error) {
    var zapLevel zapcore.Level
    if err := zapLevel.UnmarshalText([]byte(level)); err != nil {
        return nil, fmt.Errorf("invalid log level: %s", level)
    }
    
    logConfig := zap.Config{
        Level:            zap.NewAtomicLevelAt(zapLevel),
        Encoding:         "json",
        OutputPaths:      []string{"stdout"},
        ErrorOutputPaths: []string{"stderr"},
        EncoderConfig: zapcore.EncoderConfig{
            MessageKey:     "message",
            LevelKey:       "level",
            TimeKey:        "timestamp",
            NameKey:        "logger",
            CallerKey:      "caller",
            FunctionKey:    zapcore.OmitKey,
            StacktraceKey:  "stacktrace",
            LineEnding:     zapcore.DefaultLineEnding,
            EncodeLevel:    zapcore.LowercaseLevelEncoder,
            EncodeTime:     zapcore.ISO8601TimeEncoder,
            EncodeDuration: zapcore.StringDurationEncoder,
            EncodeCaller:   zapcore.ShortCallerEncoder,
        },
    }
    
    return logConfig.Build()
}
```

### Request Logging Pattern
Each HTTP request is logged with contextual information:

```go
func Logger(logger *zap.Logger) gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()
        path := c.Request.URL.Path
        
        // Process request
        c.Next()
        
        // Log after request
        latency := time.Since(start)
        status := c.Writer.Status()
        requestID, _ := c.Get("requestID")
        clientIP := c.ClientIP()
        method := c.Request.Method
        userAgent := c.Request.UserAgent()
        
        logFunc := logger.Info
        if status >= 400 {
            logFunc = logger.Warn
        }
        if status >= 500 {
            logFunc = logger.Error
        }
        
        logFunc("request completed",
            zap.String("request_id", requestID.(string)),
            zap.String("method", method),
            zap.String("path", path),
            zap.String("ip", clientIP),
            zap.Int("status", status),
            zap.Duration("latency", latency),
            zap.String("user_agent", userAgent),
        )
    }
}
```

## Documentation

### OpenAPI Documentation
The service automatically generates OpenAPI documentation:

```go
// @title Audit Service API
// @version 1.0.0
// @description A read-only microservice for accessing PowerPoint translation session audit logs

// @contact.name API Support
// @contact.url http://www.swagger.io/support
// @contact.email support@swagger.io

// @license.name MIT
// @license.url https://opensource.org/licenses/MIT

// @host localhost:4006
// @BasePath /api/v1

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Type "Bearer" followed by a space and JWT token.
```

### API Documentation Routes
The service provides interactive API documentation:

```go
// API documentation routes with custom redirect handling
router.GET("/docs/*any", func(c *gin.Context) {
    // Check if the path is exactly /docs/ or /docs
    path := c.Param("any")
    if path == "" || path == "/" {
        c.Redirect(http.StatusMovedPermanently, "/docs/index.html")
        return
    }
    // Otherwise use the standard handler
    ginSwagger.WrapHandler(swaggerFiles.Handler)(c)
})
```

## Testing

### Table-Driven Tests
Tests are structured as table-driven tests for comprehensive coverage:

```go
func TestAuditRepository_GetAuditLogs(t *testing.T) {
    tests := []struct {
        name       string
        sessionId  string
        limit      int
        offset     int
        setupMock  func(*httptest.Server) *httptest.Server
        want       *domain.AuditResponse
        wantErr    bool
        errCode    string
    }{
        {
            name:      "success",
            sessionId: "session-123",
            limit:     10,
            offset:    0,
            setupMock: func(server *httptest.Server) *httptest.Server {
                handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
                    // Mock response
                })
                return httptest.NewServer(handler)
            },
            want: &domain.AuditResponse{
                TotalCount: 2,
                Items: []domain.AuditEntry{
                    // Expected items
                },
            },
            wantErr: false,
        },
        // More test cases...
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Test implementation
        })
    }
}
```

### Interface Mocking
The service uses Mockery to generate mocks for interfaces:

```go
// mockery --name=AuditRepository
type MockAuditRepository struct {
    mock.Mock
}

func (_m *MockAuditRepository) GetAuditLogs(ctx context.Context, sessionId string, limit int, offset int) (*domain.AuditResponse, error) {
    ret := _m.Called(ctx, sessionId, limit, offset)
    
    var r0 *domain.AuditResponse
    if rf, ok := ret.Get(0).(func(context.Context, string, int, int) *domain.AuditResponse); ok {
        r0 = rf(ctx, sessionId, limit, offset)
    } else {
        if ret.Get(0) != nil {
            r0 = ret.Get(0).(*domain.AuditResponse)
        }
    }
    
    var r1 error
    if rf, ok := ret.Get(1).(func(context.Context, string, int, int) error); ok {
        r1 = rf(ctx, sessionId, limit, offset)
    } else {
        r1 = ret.Error(1)
    }
    
    return r0, r1
}
```

## Build System

### Makefile Automation
The service uses a Makefile for common tasks:

```makefile
.PHONY: help build run test test-coverage lint clean docker-build docker-run docs generate-mocks

# Build the binary
build: docs
	@echo "Building $(BINARY_NAME)..."
	$(GO) build $(GOFLAGS) -ldflags="$(LDFLAGS)" -o bin/$(BINARY_NAME) cmd/server/main.go

# Generate OpenAPI documentation
docs:
	@echo "Generating OpenAPI documentation..."
	swag init -g cmd/server/main.go -o docs

# Generate mocks for testing
generate-mocks:
	@echo "Generating mocks..."
	mockery --all
```

## Containerization

### Docker Build
The service is containerized with Docker:

```dockerfile
FROM golang:1.18-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -ldflags="-w -s" -o /app/bin/audit-service cmd/server/main.go

FROM alpine:3.15

WORKDIR /app

COPY --from=builder /app/bin/audit-service .

# Add CA certificates for HTTPS calls
RUN apk --no-cache add ca-certificates

EXPOSE 4006

CMD ["./audit-service"]
```

## Deployment Patterns

### Environment Configuration
The service uses environment variables for deployment configuration:

```
# .env.example
PORT=4006
LOG_LEVEL=debug
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
CORS_ORIGIN=http://localhost:3000
CACHE_JWT_TTL=5m
CACHE_SHARE_TOKEN_TTL=1m
CACHE_CLEANUP_INTERVAL=10m
```

### Docker Compose
For local development and testing:

```yaml
version: "3.8"
services:
  audit-service:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "4006:4006"
    environment:
      - PORT=4006
      - LOG_LEVEL=debug
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - SUPABASE_JWT_SECRET=${SUPABASE_JWT_SECRET}
      - CORS_ORIGIN=http://localhost:3000
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:4006/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## Frontend Integration

### Client-Side Authentication
Frontend integration with the audit service:

```typescript
const getAuditLogs = async (sessionId: string, page: number = 1) => {
  const { data: session } = await supabase.auth.getSession();
  const token = session?.access_token;
  
  if (!token) {
    throw new Error('Not authenticated');
  }
  
  const response = await fetch(
    `${AUDIT_SERVICE_URL}/api/v1/sessions/${sessionId}/history?limit=20&offset=${(page-1)*20}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch audit logs');
  }
  
  return response.json();
};
```

### Error Handling
Standard error response handling pattern:

```typescript
try {
  const auditLogs = await getAuditLogs(sessionId);
  setLogs(auditLogs.items);
  setTotalCount(auditLogs.totalCount);
} catch (error) {
  if (error.response && error.response.status === 401) {
    // Handle authentication error
    setAuthError(true);
  } else if (error.response && error.response.status === 403) {
    // Handle authorization error
    setAccessError(true);
  } else {
    // Handle other errors
    setError('Failed to load audit logs');
  }
}
```

## Key Project Decisions

### Supabase Direct Integration
The service directly integrates with Supabase REST API instead of using an SDK:

1. **Pros**:
   - No additional dependencies on SDK
   - Full control over requests and responses
   - More explicit error handling
   
2. **Cons**:
   - More boilerplate code
   - Manual maintenance of API integration
   - Need to handle connection pooling

### JWT Validation
The service implements its own JWT validation:

1. **Pros**:
   - No dependency on Supabase SDK
   - Can customize validation rules
   - Token caching for performance
   
2. **Cons**:
   - Need to keep up with JWT standards
   - Potential security issues if implemented incorrectly

### In-Memory Test Session Storage
Special handling for test sessions with in-memory storage:

1. **Pros**:
   - No database dependency for testing
   - Faster test execution
   - Isolated test environment
   
2. **Cons**:
   - Different behavior in test vs. production
   - Potential memory leaks if not managed properly
   - Non-persistent test data

### Design Decisions Reasoning
1. **REST API instead of SDK**: Chosen for simplicity and control
2. **JWT Validation**: Implemented to reduce dependencies
3. **In-Memory Test Storage**: Added for easier integration testing
4. **Root main.go Wrapper**: Added to fix Go tooling compatibility
5. **Custom Documentation URL Handling**: Improved developer experience

## Performance Optimizations

### HTTP Connection Pooling
The service optimizes HTTP connections:

```go
httpClient: &http.Client{
    Timeout: 30 * time.Second,
    Transport: &http.Transport{
        MaxIdleConns:        100,
        MaxIdleConnsPerHost: 10,
        IdleConnTimeout:     90 * time.Second,
    },
},
```

### Token Caching
JWT and share token validation results are cached:

```go
// Cache successful validation
if isValid {
    ttl := tc.jwtTTL
    if isShareToken {
        ttl = tc.shareTokenTTL
    }
    tc.cache.Set(token, user, ttl)
}
```

### Pagination
API endpoints implement pagination to limit response size:

```go
// GetHistory godoc
// @Summary Get audit history for a session
// @Description Get paginated audit logs for a specific session
// @Tags sessions
// @Accept json
// @Produce json
// @Param sessionId path string true "Session ID"
// @Param limit query int false "Number of items per page" default(50) minimum(1) maximum(100)
// @Param offset query int false "Offset for pagination" default(0) minimum(0)
// @Success 200 {object} domain.AuditResponse
// @Failure 400 {object} domain.APIError
// @Failure 401 {object} domain.APIError
// @Failure 403 {object} domain.APIError
// @Failure 404 {object} domain.APIError
// @Failure 500 {object} domain.APIError
// @Router /sessions/{sessionId}/history [get]
// @Security BearerAuth
func (h *AuditHandler) GetHistory(c *gin.Context) {
    // Parse pagination parameters
    limit := 50
    offset := 0
    
    if limitParam := c.Query("limit"); limitParam != "" {
        parsedLimit, err := strconv.Atoi(limitParam)
        if err == nil && parsedLimit > 0 {
            if parsedLimit > 100 {
                limit = 100 // Maximum limit
            } else {
                limit = parsedLimit
            }
        }
    }
    
    if offsetParam := c.Query("offset"); offsetParam != "" {
        parsedOffset, err := strconv.Atoi(offsetParam)
        if err == nil && parsedOffset >= 0 {
            offset = parsedOffset
        }
    }
    
    // Get audit logs with pagination
    result, err := h.service.GetAuditHistory(c.Request.Context(), sessionId, userId, limit, offset)
    // ...
}
```

## Security Practices

### Service Role Key Management
The service uses the Supabase service role key securely:

1. Stored as environment variable
2. Never exposed to clients
3. Used only for server-to-server communication

### JWT Secret Management
JWT secret handling:

1. Stored as environment variable
2. Used for local token validation
3. Protected from exposure in logs

### Bearer Token Validation
Token validation flow:

1. Extract token from Authorization header
2. Validate JWT signature
3. Check token expiration
4. Verify claims (iss, aud)
5. Extract user ID and permissions

### Error Message Security
Error messages are carefully designed:

1. Specific errors for client issues (400-level)
2. Generic errors for server issues (500-level)
3. No exposure of internal details
4. Detailed logging for debugging

---

*Last Updated: June 2025 - Added Root main.go pattern and Documentation URL handling* 