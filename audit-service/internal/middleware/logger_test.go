package middleware

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

func TestLogger(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		setupRequest   func(*http.Request)
		setupHandler   func(*gin.Context)
		expectedStatus int
		expectedLogs   []string
	}{
		{
			name: "success_get_request",
			setupRequest: func(req *http.Request) {
				req.Method = "GET"
				req.URL.Path = "/api/v1/sessions/test-session/history"
				req.Header.Set("User-Agent", "test-client/1.0")
			},
			setupHandler: func(c *gin.Context) {
				c.JSON(200, gin.H{"success": true})
			},
			expectedStatus: 200,
			expectedLogs: []string{
				"request completed",
				"GET",
				"/api/v1/sessions/test-session/history",
				"200",
				"test-client/1.0",
			},
		},
		{
			name: "error_post_request",
			setupRequest: func(req *http.Request) {
				req.Method = "POST"
				req.URL.Path = "/api/v1/sessions"
				req.Header.Set("Content-Type", "application/json")
			},
			setupHandler: func(c *gin.Context) {
				c.JSON(400, gin.H{"error": "bad request"})
			},
			expectedStatus: 400,
			expectedLogs: []string{
				"client error",
				"POST",
				"/api/v1/sessions",
				"400",
			},
		},
		{
			name: "success_with_query_params",
			setupRequest: func(req *http.Request) {
				req.Method = "GET"
				req.URL.Path = "/api/v1/sessions/test-session/history"
				req.URL.RawQuery = "limit=10&offset=0"
			},
			setupHandler: func(c *gin.Context) {
				c.JSON(200, gin.H{"data": []string{}})
			},
			expectedStatus: 200,
			expectedLogs: []string{
				"request completed",
				"GET",
				"/api/v1/sessions/test-session/history",
				"200",
				"limit=10&offset=0",
			},
		},
		{
			name: "internal_server_error",
			setupRequest: func(req *http.Request) {
				req.Method = "GET"
				req.URL.Path = "/api/v1/sessions/error-session/history"
			},
			setupHandler: func(c *gin.Context) {
				c.JSON(500, gin.H{"error": "internal server error"})
			},
			expectedStatus: 500,
			expectedLogs: []string{
				"server error",
				"GET",
				"/api/v1/sessions/error-session/history",
				"500",
			},
		},
		{
			name: "with_request_id",
			setupRequest: func(req *http.Request) {
				req.Method = "GET"
				req.URL.Path = "/test"
				req.Header.Set("X-Request-ID", "test-request-id-123")
			},
			setupHandler: func(c *gin.Context) {
				c.JSON(200, gin.H{"success": true})
			},
			expectedStatus: 200,
			expectedLogs: []string{
				"request completed",
				"test-request-id-123",
				"GET",
				"/test",
				"200",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup logger with in-memory buffer to capture logs
			var logBuffer bytes.Buffer
			encoder := zapcore.NewJSONEncoder(zap.NewDevelopmentEncoderConfig())
			core := zapcore.NewCore(encoder, zapcore.AddSync(&logBuffer), zapcore.DebugLevel)
			logger := zap.New(core)

			// Setup router with middleware
			router := gin.New()
			router.Use(RequestID()) // RequestID middleware needed for logger
			router.Use(Logger(logger))

			// Test endpoint
			router.Any("/*path", tt.setupHandler)

			// Create request
			req, _ := http.NewRequest("GET", "/test", nil)
			tt.setupRequest(req)

			// Execute
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			// Assert HTTP response
			assert.Equal(t, tt.expectedStatus, w.Code)

			// Assert logs contain expected content
			logOutput := logBuffer.String()
			for _, expectedLog := range tt.expectedLogs {
				assert.Contains(t, logOutput, expectedLog, "Log should contain: %s", expectedLog)
			}

			// Verify it's proper JSON log format
			var logEntry map[string]interface{}
			lines := bytes.Split(logBuffer.Bytes(), []byte("\n"))
			if len(lines) > 0 && len(lines[0]) > 0 {
				err := json.Unmarshal(lines[0], &logEntry)
				assert.NoError(t, err, "Log output should be valid JSON")

				// Verify required fields are present
				assert.Contains(t, logEntry, "L", "Should have level field")
				assert.Contains(t, logEntry, "M", "Should have message field")
				assert.Contains(t, logEntry, "method")
				assert.Contains(t, logEntry, "path")
				assert.Contains(t, logEntry, "status")
				assert.Contains(t, logEntry, "latency", "Should have latency field")
			}
		})
	}
}

func TestLogger_WithVariousStatusCodes(t *testing.T) {
	gin.SetMode(gin.TestMode)

	statusCodes := []int{200, 201, 400, 401, 403, 404, 500, 502}

	for _, statusCode := range statusCodes {
		t.Run(fmt.Sprintf("status_%d", statusCode), func(t *testing.T) {
			// Setup logger with buffer
			var logBuffer bytes.Buffer
			encoder := zapcore.NewJSONEncoder(zap.NewDevelopmentEncoderConfig())
			core := zapcore.NewCore(encoder, zapcore.AddSync(&logBuffer), zapcore.DebugLevel)
			logger := zap.New(core)

			// Setup router
			router := gin.New()
			router.Use(RequestID())
			router.Use(Logger(logger))

			router.GET("/test", func(c *gin.Context) {
				c.JSON(statusCode, gin.H{"status": statusCode})
			})

			// Execute request
			req, _ := http.NewRequest("GET", "/test", nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			// Assert
			assert.Equal(t, statusCode, w.Code)

			// Verify status code is logged
			logOutput := logBuffer.String()
			assert.Contains(t, logOutput, fmt.Sprintf(`"status":%d`, statusCode))
		})
	}
}

func TestLogger_Performance(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Setup logger
	logger := zap.NewNop() // No-op logger for performance testing

	// Setup router
	router := gin.New()
	router.Use(RequestID())
	router.Use(Logger(logger))

	router.GET("/test", func(c *gin.Context) {
		c.JSON(200, gin.H{"success": true})
	})

	// Make multiple requests to ensure middleware doesn't break
	for i := 0; i < 100; i++ {
		req, _ := http.NewRequest("GET", "/test", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		assert.Equal(t, 200, w.Code)
	}
}
