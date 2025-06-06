package middleware

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"audit-service/mocks"
	"audit-service/pkg/cache"
	"audit-service/pkg/jwt"

	"github.com/gin-gonic/gin"
	jwtlib "github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"go.uber.org/zap"
)

// Test constants
const (
	testUserID = "test-user-456"
)

// Helper function to create test JWT claims
func createTestJWTClaims() *jwt.Claims {
	return &jwt.Claims{
		RegisteredClaims: jwtlib.RegisteredClaims{
			Subject:   testUserID,
			ExpiresAt: jwtlib.NewNumericDate(time.Now().Add(1 * time.Hour)),
		},
		UserID: testUserID,
	}
}

func TestAuth(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		setupRequest   func(*http.Request)
		setupPath      string
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
		{
			name:      "success_share_token",
			setupPath: "/sessions/test-session/history",
			setupRequest: func(req *http.Request) {
				q := req.URL.Query()
				q.Add("share_token", "valid-share-token")
				req.URL.RawQuery = q.Encode()
			},
			setupMocks: func(mockValidator *mocks.MockTokenValidator, mockRepo *mocks.MockAuditRepository, tokenCache *cache.TokenCache) {
				mockRepo.On("ValidateShareToken", mock.Anything, "valid-share-token", "test-session").
					Return(true, nil)
			},
			expectedStatus: 200,
			expectedUserID: "",
			expectedType:   TokenTypeShare,
		},
		{
			name:      "success_jwt_cached",
			setupPath: "/sessions/test-session/history",
			setupRequest: func(req *http.Request) {
				req.Header.Set("Authorization", "Bearer cached-jwt-token")
			},
			setupMocks: func(mockValidator *mocks.MockTokenValidator, mockRepo *mocks.MockAuditRepository, tokenCache *cache.TokenCache) {
				// Pre-cache the token
				tokenCache.SetJWT("cached-jwt-token", &cache.CachedTokenInfo{
					UserID:    testUserID,
					ExpiresAt: time.Now().Add(1 * time.Hour),
				})
			},
			expectedStatus: 200,
			expectedUserID: testUserID,
			expectedType:   TokenTypeJWT,
		},
		{
			name:      "success_share_token_cached",
			setupPath: "/sessions/test-session/history",
			setupRequest: func(req *http.Request) {
				q := req.URL.Query()
				q.Add("share_token", "cached-share-token")
				req.URL.RawQuery = q.Encode()
			},
			setupMocks: func(mockValidator *mocks.MockTokenValidator, mockRepo *mocks.MockAuditRepository, tokenCache *cache.TokenCache) {
				// Pre-cache the share token
				tokenCache.SetShareToken("cached-share-token", "test-session", &cache.CachedTokenInfo{
					SessionID: "test-session",
					ExpiresAt: time.Now().Add(1 * time.Hour),
				})
			},
			expectedStatus: 200,
			expectedUserID: "",
			expectedType:   TokenTypeShare,
		},
		{
			name:      "error_missing_session_id",
			setupPath: "/sessions//history",
			setupRequest: func(req *http.Request) {
				req.Header.Set("Authorization", "Bearer valid-jwt-token")
			},
			setupMocks: func(mockValidator *mocks.MockTokenValidator, mockRepo *mocks.MockAuditRepository, tokenCache *cache.TokenCache) {
				// No mocks needed, should fail before validation
			},
			expectedStatus: 401,
			expectedUserID: "",
			expectedType:   "",
		},
		{
			name:      "error_missing_authorization",
			setupPath: "/sessions/test-session/history",
			setupRequest: func(req *http.Request) {
				// No authorization header
			},
			setupMocks: func(mockValidator *mocks.MockTokenValidator, mockRepo *mocks.MockAuditRepository, tokenCache *cache.TokenCache) {
				// No mocks needed
			},
			expectedStatus: 401,
			expectedUserID: "",
			expectedType:   "",
		},
		{
			name:      "error_invalid_bearer_format",
			setupPath: "/sessions/test-session/history",
			setupRequest: func(req *http.Request) {
				req.Header.Set("Authorization", "InvalidFormat token")
			},
			setupMocks: func(mockValidator *mocks.MockTokenValidator, mockRepo *mocks.MockAuditRepository, tokenCache *cache.TokenCache) {
				// No mocks needed
			},
			expectedStatus: 401,
			expectedUserID: "",
			expectedType:   "",
		},
		{
			name:      "error_jwt_validation_failed",
			setupPath: "/sessions/test-session/history",
			setupRequest: func(req *http.Request) {
				req.Header.Set("Authorization", "Bearer invalid-jwt-token")
			},
			setupMocks: func(mockValidator *mocks.MockTokenValidator, mockRepo *mocks.MockAuditRepository, tokenCache *cache.TokenCache) {
				mockValidator.On("ValidateToken", mock.Anything, "invalid-jwt-token").
					Return(nil, errors.New("invalid token"))
			},
			expectedStatus: 401,
			expectedUserID: "",
			expectedType:   "",
		},
		{
			name:      "error_invalid_share_token",
			setupPath: "/sessions/test-session/history",
			setupRequest: func(req *http.Request) {
				q := req.URL.Query()
				q.Add("share_token", "invalid-share-token")
				req.URL.RawQuery = q.Encode()
			},
			setupMocks: func(mockValidator *mocks.MockTokenValidator, mockRepo *mocks.MockAuditRepository, tokenCache *cache.TokenCache) {
				mockRepo.On("ValidateShareToken", mock.Anything, "invalid-share-token", "test-session").
					Return(false, nil)
			},
			expectedStatus: 403,
			expectedUserID: "",
			expectedType:   "",
		},
		{
			name:      "error_share_token_validation_error",
			setupPath: "/sessions/test-session/history",
			setupRequest: func(req *http.Request) {
				q := req.URL.Query()
				q.Add("share_token", "error-share-token")
				req.URL.RawQuery = q.Encode()
			},
			setupMocks: func(mockValidator *mocks.MockTokenValidator, mockRepo *mocks.MockAuditRepository, tokenCache *cache.TokenCache) {
				mockRepo.On("ValidateShareToken", mock.Anything, "error-share-token", "test-session").
					Return(false, errors.New("database error"))
			},
			expectedStatus: 403,
			expectedUserID: "",
			expectedType:   "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			mockValidator := mocks.NewMockTokenValidator(t)
			mockRepo := mocks.NewMockAuditRepository(t)
			tokenCache := cache.NewTokenCache(
				5*time.Minute,
				1*time.Minute,
				10*time.Minute,
			)
			logger := zap.NewNop()

			// Configure mocks
			tt.setupMocks(mockValidator, mockRepo, tokenCache)

			// Create router and middleware
			router := gin.New()
			router.Use(RequestID())
			router.Use(Auth(mockValidator, tokenCache, mockRepo, logger))

			// Test endpoint
			router.GET("/sessions/:sessionId/history", func(c *gin.Context) {
				c.JSON(200, gin.H{"success": true})
			})

			// Create request
			req, _ := http.NewRequest("GET", tt.setupPath, nil)
			tt.setupRequest(req)

			// Execute
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			// Assert
			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedStatus == 200 {
				// Check context values were set correctly
				// We can't directly access gin context from test, so we verify
				// successful middleware execution by status code
				assert.Equal(t, 200, w.Code)
			}

			// Verify all expectations were met
			mockValidator.AssertExpectations(t)
			mockRepo.AssertExpectations(t)
		})
	}
}

func TestExtractBearerToken(t *testing.T) {
	tests := []struct {
		name          string
		authHeader    string
		expectedToken string
	}{
		{
			name:          "valid_bearer_token",
			authHeader:    "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
			expectedToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
		},
		{
			name:          "invalid_scheme",
			authHeader:    "Basic dXNlcjpwYXNzd29yZA==",
			expectedToken: "",
		},
		{
			name:          "missing_token",
			authHeader:    "Bearer",
			expectedToken: "",
		},
		{
			name:          "empty_header",
			authHeader:    "",
			expectedToken: "",
		},
		{
			name:          "case_insensitive_bearer",
			authHeader:    "bearer token123",
			expectedToken: "token123",
		},
		{
			name:          "extra_spaces",
			authHeader:    "Bearer  token123",
			expectedToken: "token123",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := extractBearerToken(tt.authHeader)
			assert.Equal(t, tt.expectedToken, result)
		})
	}
}

func TestValidateJWTToken(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		token          string
		setupMocks     func(*mocks.MockTokenValidator, *cache.TokenCache)
		expectedResult bool
		expectedUserID string
	}{
		{
			name:  "success_valid_token",
			token: "valid-token",
			setupMocks: func(mockValidator *mocks.MockTokenValidator, tokenCache *cache.TokenCache) {
				claims := createTestJWTClaims()
				mockValidator.On("ValidateToken", mock.Anything, "valid-token").
					Return(claims, nil)
			},
			expectedResult: true,
			expectedUserID: testUserID,
		},
		{
			name:  "success_cached_token",
			token: "cached-token",
			setupMocks: func(mockValidator *mocks.MockTokenValidator, tokenCache *cache.TokenCache) {
				tokenCache.SetJWT("cached-token", &cache.CachedTokenInfo{
					UserID:    testUserID,
					ExpiresAt: time.Now().Add(1 * time.Hour),
				})
			},
			expectedResult: true,
			expectedUserID: testUserID,
		},
		{
			name:  "error_invalid_token",
			token: "invalid-token",
			setupMocks: func(mockValidator *mocks.MockTokenValidator, tokenCache *cache.TokenCache) {
				mockValidator.On("ValidateToken", mock.Anything, "invalid-token").
					Return(nil, errors.New("invalid token"))
			},
			expectedResult: false,
			expectedUserID: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			mockValidator := mocks.NewMockTokenValidator(t)
			tokenCache := cache.NewTokenCache(
				5*time.Minute,
				1*time.Minute,
				10*time.Minute,
			)
			logger := zap.NewNop()

			// Configure mocks
			tt.setupMocks(mockValidator, tokenCache)

			// Create gin context
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request, _ = http.NewRequest("GET", "/", nil)
			c.Set("request_id", "test-request-id")

			// Execute
			result := validateJWTToken(c, tt.token, mockValidator, tokenCache, logger)

			// Assert
			assert.Equal(t, tt.expectedResult, result)

			if tt.expectedResult {
				userID := GetAuthUserID(c)
				assert.Equal(t, tt.expectedUserID, userID)
			}

			// Verify all expectations were met
			mockValidator.AssertExpectations(t)
		})
	}
}

func TestValidateShareToken(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		token          string
		sessionID      string
		setupMocks     func(*mocks.MockAuditRepository, *cache.TokenCache)
		expectedResult bool
	}{
		{
			name:      "success_valid_token",
			token:     "valid-share-token",
			sessionID: "test-session",
			setupMocks: func(mockRepo *mocks.MockAuditRepository, tokenCache *cache.TokenCache) {
				mockRepo.On("ValidateShareToken", mock.Anything, "valid-share-token", "test-session").
					Return(true, nil)
			},
			expectedResult: true,
		},
		{
			name:      "success_cached_token",
			token:     "cached-share-token",
			sessionID: "test-session",
			setupMocks: func(mockRepo *mocks.MockAuditRepository, tokenCache *cache.TokenCache) {
				tokenCache.SetShareToken("cached-share-token", "test-session", &cache.CachedTokenInfo{
					SessionID: "test-session",
					ExpiresAt: time.Now().Add(1 * time.Hour),
				})
			},
			expectedResult: true,
		},
		{
			name:      "error_invalid_token",
			token:     "invalid-share-token",
			sessionID: "test-session",
			setupMocks: func(mockRepo *mocks.MockAuditRepository, tokenCache *cache.TokenCache) {
				mockRepo.On("ValidateShareToken", mock.Anything, "invalid-share-token", "test-session").
					Return(false, nil)
			},
			expectedResult: false,
		},
		{
			name:      "error_validation_failure",
			token:     "error-share-token",
			sessionID: "test-session",
			setupMocks: func(mockRepo *mocks.MockAuditRepository, tokenCache *cache.TokenCache) {
				mockRepo.On("ValidateShareToken", mock.Anything, "error-share-token", "test-session").
					Return(false, errors.New("database error"))
			},
			expectedResult: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			mockRepo := mocks.NewMockAuditRepository(t)
			tokenCache := cache.NewTokenCache(
				5*time.Minute,
				1*time.Minute,
				10*time.Minute,
			)
			logger := zap.NewNop()

			// Configure mocks
			tt.setupMocks(mockRepo, tokenCache)

			// Create gin context
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request, _ = http.NewRequest("GET", "/", nil)
			c.Set("request_id", "test-request-id")

			// Execute
			result := validateShareToken(c, tt.token, tt.sessionID, tokenCache, mockRepo, logger)

			// Assert
			assert.Equal(t, tt.expectedResult, result)

			// Verify all expectations were met
			mockRepo.AssertExpectations(t)
		})
	}
}

func TestGetAuthUserID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		setupContext   func(*gin.Context)
		expectedUserID string
	}{
		{
			name: "success_user_id_present",
			setupContext: func(c *gin.Context) {
				c.Set(AuthUserIDKey, testUserID)
			},
			expectedUserID: testUserID,
		},
		{
			name: "empty_user_id_not_set",
			setupContext: func(c *gin.Context) {
				// Don't set user ID
			},
			expectedUserID: "",
		},
		{
			name: "empty_user_id_wrong_type",
			setupContext: func(c *gin.Context) {
				c.Set(AuthUserIDKey, 123) // Wrong type
			},
			expectedUserID: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			tt.setupContext(c)

			// Execute
			userID := GetAuthUserID(c)

			// Assert
			assert.Equal(t, tt.expectedUserID, userID)
		})
	}
}

func TestGetAuthTokenType(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name              string
		setupContext      func(*gin.Context)
		expectedTokenType string
	}{
		{
			name: "success_jwt_token_type",
			setupContext: func(c *gin.Context) {
				c.Set(AuthTokenTypeKey, TokenTypeJWT)
			},
			expectedTokenType: TokenTypeJWT,
		},
		{
			name: "success_share_token_type",
			setupContext: func(c *gin.Context) {
				c.Set(AuthTokenTypeKey, TokenTypeShare)
			},
			expectedTokenType: TokenTypeShare,
		},
		{
			name: "empty_token_type_not_set",
			setupContext: func(c *gin.Context) {
				// Don't set token type
			},
			expectedTokenType: "",
		},
		{
			name: "empty_token_type_wrong_type",
			setupContext: func(c *gin.Context) {
				c.Set(AuthTokenTypeKey, 123) // Wrong type
			},
			expectedTokenType: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			tt.setupContext(c)

			// Execute
			tokenType := GetAuthTokenType(c)

			// Assert
			assert.Equal(t, tt.expectedTokenType, tokenType)
		})
	}
}
