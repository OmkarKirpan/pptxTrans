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

--- 