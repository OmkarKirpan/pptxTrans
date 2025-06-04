package middleware

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"audit-service/internal/domain"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

func TestErrorHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		setupHandler   func(*gin.Context)
		expectedStatus int
		expectedBody   map[string]interface{}
		expectLogs     bool
		expectedLogMsg string
	}{
		{
			name: "success_no_errors",
			setupHandler: func(c *gin.Context) {
				c.JSON(200, gin.H{"success": true})
			},
			expectedStatus: 200,
			expectedBody: map[string]interface{}{
				"success": true,
			},
			expectLogs: false,
		},
		{
			name: "handles_client_error_400",
			setupHandler: func(c *gin.Context) {
				c.JSON(400, domain.APIErrInvalidRequest)
			},
			expectedStatus: 400,
			expectedBody: map[string]interface{}{
				"error":   "invalid_request",
				"message": "Invalid request parameters",
			},
			expectLogs: false, // Client errors shouldn't be logged as server errors
		},
		{
			name: "handles_unauthorized_401",
			setupHandler: func(c *gin.Context) {
				c.JSON(401, domain.APIErrUnauthorized)
			},
			expectedStatus: 401,
			expectedBody: map[string]interface{}{
				"error":   "unauthorized",
				"message": "Authentication required",
			},
			expectLogs: false,
		},
		{
			name: "handles_forbidden_403",
			setupHandler: func(c *gin.Context) {
				c.JSON(403, domain.APIErrForbidden)
			},
			expectedStatus: 403,
			expectedBody: map[string]interface{}{
				"error":   "forbidden",
				"message": "Access denied to this resource",
			},
			expectLogs: false,
		},
		{
			name: "handles_not_found_404",
			setupHandler: func(c *gin.Context) {
				c.JSON(404, domain.APIErrNotFound)
			},
			expectedStatus: 404,
			expectedBody: map[string]interface{}{
				"error":   "not_found",
				"message": "The requested resource was not found",
			},
			expectLogs: false,
		},
		{
			name: "logs_server_error_500",
			setupHandler: func(c *gin.Context) {
				c.JSON(500, domain.APIErrInternalServer)
			},
			expectedStatus: 500,
			expectedBody: map[string]interface{}{
				"error":   "internal_server_error",
				"message": "An internal server error occurred",
			},
			expectLogs:     true,
			expectedLogMsg: "server error response",
		},
		{
			name: "logs_server_error_502",
			setupHandler: func(c *gin.Context) {
				c.JSON(502, gin.H{
					"error":   "bad_gateway",
					"message": "Bad gateway error",
				})
			},
			expectedStatus: 502,
			expectedBody: map[string]interface{}{
				"error":   "bad_gateway",
				"message": "Bad gateway error",
			},
			expectLogs:     true,
			expectedLogMsg: "server error response",
		},
		{
			name: "handles_custom_error_format",
			setupHandler: func(c *gin.Context) {
				c.JSON(422, gin.H{
					"error":   "validation_failed",
					"message": "Validation failed",
					"details": "Field 'name' is required",
				})
			},
			expectedStatus: 422,
			expectedBody: map[string]interface{}{
				"error":   "validation_failed",
				"message": "Validation failed",
				"details": "Field 'name' is required",
			},
			expectLogs: false,
		},
		{
			name: "handles_non_json_response",
			setupHandler: func(c *gin.Context) {
				c.String(500, "Internal Server Error")
			},
			expectedStatus: 500,
			expectedBody:   nil, // Non-JSON response
			expectLogs:     true,
			expectedLogMsg: "server error response",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup logger with buffer to capture logs
			var logBuffer bytes.Buffer
			encoder := zapcore.NewJSONEncoder(zap.NewDevelopmentEncoderConfig())
			core := zapcore.NewCore(encoder, zapcore.AddSync(&logBuffer), zapcore.DebugLevel)
			logger := zap.New(core)

			// Setup router with middleware
			router := gin.New()
			router.Use(RequestID())
			router.Use(ErrorHandler(logger))

			// Test endpoint
			router.GET("/test", tt.setupHandler)

			// Execute request
			req, _ := http.NewRequest("GET", "/test", nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			// Assert HTTP response
			assert.Equal(t, tt.expectedStatus, w.Code)

			// Assert response body if JSON expected
			if tt.expectedBody != nil {
				var responseBody map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &responseBody)
				assert.NoError(t, err, "Response should be valid JSON")

				for key, expectedValue := range tt.expectedBody {
					assert.Equal(t, expectedValue, responseBody[key], "Field %s should match", key)
				}
			}

			// Assert logging behavior
			logOutput := logBuffer.String()
			if tt.expectLogs {
				assert.Contains(t, logOutput, tt.expectedLogMsg, "Should log server errors")
				assert.Contains(t, logOutput, fmt.Sprintf(`"status":%d`, tt.expectedStatus))
			} else {
				// For client errors, logs should be minimal or empty
				if logOutput != "" {
					assert.NotContains(t, logOutput, "error", "Client errors should not be logged as errors")
				}
			}
		})
	}
}

func TestErrorHandler_WithAbort(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Setup logger
	var logBuffer bytes.Buffer
	encoder := zapcore.NewJSONEncoder(zap.NewDevelopmentEncoderConfig())
	core := zapcore.NewCore(encoder, zapcore.AddSync(&logBuffer), zapcore.DebugLevel)
	logger := zap.New(core)

	// Setup router
	router := gin.New()
	router.Use(RequestID())
	router.Use(ErrorHandler(logger))

	// Middleware that aborts with error
	router.Use(func(c *gin.Context) {
		c.JSON(401, domain.APIErrUnauthorized)
		c.Abort()
	})

	// This handler should not be reached
	router.GET("/test", func(c *gin.Context) {
		c.JSON(200, gin.H{"should": "not reach"})
	})

	// Execute request
	req, _ := http.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, 401, w.Code)

	var responseBody map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &responseBody)
	assert.NoError(t, err)
	assert.Equal(t, "unauthorized", responseBody["error"])
}

func TestErrorHandler_WithPanic(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Setup logger
	var logBuffer bytes.Buffer
	encoder := zapcore.NewJSONEncoder(zap.NewDevelopmentEncoderConfig())
	core := zapcore.NewCore(encoder, zapcore.AddSync(&logBuffer), zapcore.DebugLevel)
	logger := zap.New(core)

	// Setup router with recovery and error handler
	router := gin.New()
	router.Use(RequestID())
	router.Use(gin.Recovery()) // Recovery middleware should handle panics
	router.Use(ErrorHandler(logger))

	// Handler that panics
	router.GET("/test", func(c *gin.Context) {
		panic("test panic")
	})

	// Execute request
	req, _ := http.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assert that recovery middleware handled the panic
	assert.Equal(t, 500, w.Code)
}

func TestErrorHandler_ChainedMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Setup logger
	logger := zap.NewNop()

	// Setup router with multiple middleware
	router := gin.New()
	router.Use(RequestID())
	router.Use(ErrorHandler(logger))

	// Middleware that sets a header and continues
	router.Use(func(c *gin.Context) {
		c.Header("X-Test", "middleware-ran")
		c.Next()
	})

	// Handler that returns success
	router.GET("/test", func(c *gin.Context) {
		c.JSON(200, gin.H{"success": true})
	})

	// Execute request
	req, _ := http.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, 200, w.Code)
	assert.Equal(t, "middleware-ran", w.Header().Get("X-Test"))

	var responseBody map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &responseBody)
	assert.NoError(t, err)
	assert.Equal(t, true, responseBody["success"])
}

func TestHandleNotFound(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Setup router
	router := gin.New()
	router.NoRoute(HandleNotFound())

	// Execute request to non-existent route
	req, _ := http.NewRequest("GET", "/non-existent", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, 404, w.Code)

	var responseBody map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &responseBody)
	assert.NoError(t, err)
	assert.Equal(t, "not_found", responseBody["error"])
	assert.Equal(t, "The requested resource was not found", responseBody["message"])
}

func TestHandleMethodNotAllowed(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Setup router
	router := gin.New()
	// Register HandleMethodNotAllowed before adding routes
	router.HandleMethodNotAllowed = true
	router.NoMethod(HandleMethodNotAllowed())

	// Define a route with GET method
	router.GET("/test", func(c *gin.Context) {
		c.JSON(200, gin.H{"success": true})
	})

	// Execute request with wrong method (POST instead of GET)
	req, _ := http.NewRequest("POST", "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Assert
	assert.Equal(t, 405, w.Code)

	var responseBody map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &responseBody)
	assert.NoError(t, err)
	assert.Equal(t, "method_not_allowed", responseBody["error"])
	assert.Equal(t, "HTTP method not allowed for this resource", responseBody["message"])
}
