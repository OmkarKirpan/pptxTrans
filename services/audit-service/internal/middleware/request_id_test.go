package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestRequestID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name               string
		setupRequest       func(*http.Request)
		expectHeaderSet    bool
		expectContextSet   bool
		expectUniqueValues bool
	}{
		{
			name: "generates_request_id_when_not_provided",
			setupRequest: func(req *http.Request) {
				// No X-Request-ID header
			},
			expectHeaderSet:    true,
			expectContextSet:   true,
			expectUniqueValues: true,
		},
		{
			name: "uses_existing_request_id_when_provided",
			setupRequest: func(req *http.Request) {
				req.Header.Set("X-Request-ID", "existing-request-id")
			},
			expectHeaderSet:    true,
			expectContextSet:   true,
			expectUniqueValues: false,
		},
		{
			name: "handles_empty_request_id_header",
			setupRequest: func(req *http.Request) {
				req.Header.Set("X-Request-ID", "")
			},
			expectHeaderSet:    true,
			expectContextSet:   true,
			expectUniqueValues: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup router with middleware
			router := gin.New()
			router.Use(RequestID())

			var capturedRequestID string
			var capturedHeaderID string

			// Test endpoint that captures the request ID
			router.GET("/test", func(c *gin.Context) {
				capturedRequestID = GetRequestID(c)
				c.JSON(200, gin.H{"success": true})
			})

			// Create request
			req, _ := http.NewRequest("GET", "/test", nil)
			tt.setupRequest(req)

			// Execute
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			// Assert
			assert.Equal(t, 200, w.Code)

			if tt.expectHeaderSet {
				capturedHeaderID = w.Header().Get("X-Request-ID")
				assert.NotEmpty(t, capturedHeaderID)
				assert.NotEmpty(t, w.Header().Get("X-Request-ID"))
			}

			if tt.expectContextSet {
				assert.NotEmpty(t, capturedRequestID)
			}

			// Check if existing header was preserved
			if req.Header.Get("X-Request-ID") != "" && !tt.expectUniqueValues {
				assert.Equal(t, "existing-request-id", capturedRequestID)
				assert.Equal(t, "existing-request-id", capturedHeaderID)
			}

			// For empty or missing headers, verify a UUID was generated
			if tt.expectUniqueValues {
				assert.Len(t, capturedRequestID, 36) // UUID length
				assert.Contains(t, capturedRequestID, "-")
			}
		})
	}
}

func TestRequestID_UniqueValues(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Setup router
	router := gin.New()
	router.Use(RequestID())

	var requestIDs []string

	router.GET("/test", func(c *gin.Context) {
		requestIDs = append(requestIDs, GetRequestID(c))
		c.JSON(200, gin.H{"success": true})
	})

	// Make multiple requests
	for i := 0; i < 10; i++ {
		req, _ := http.NewRequest("GET", "/test", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		assert.Equal(t, 200, w.Code)
	}

	// Verify all request IDs are unique
	assert.Len(t, requestIDs, 10)
	uniqueIDs := make(map[string]bool)
	for _, id := range requestIDs {
		assert.False(t, uniqueIDs[id], "Request ID should be unique: %s", id)
		uniqueIDs[id] = true
		assert.Len(t, id, 36) // UUID format
	}
}

func TestGetRequestID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name              string
		setupContext      func(*gin.Context)
		expectedRequestID string
		expectEmpty       bool
	}{
		{
			name: "success_request_id_present",
			setupContext: func(c *gin.Context) {
				c.Set(RequestIDKey, "test-request-id")
			},
			expectedRequestID: "test-request-id",
			expectEmpty:       false,
		},
		{
			name: "empty_request_id_not_set",
			setupContext: func(c *gin.Context) {
				// Don't set request ID
			},
			expectedRequestID: "",
			expectEmpty:       true,
		},
		{
			name: "empty_request_id_wrong_type",
			setupContext: func(c *gin.Context) {
				c.Set(RequestIDKey, 123) // Wrong type
			},
			expectedRequestID: "",
			expectEmpty:       true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			tt.setupContext(c)

			// Execute
			requestID := GetRequestID(c)

			// Assert
			if tt.expectEmpty {
				assert.Empty(t, requestID)
			} else {
				assert.Equal(t, tt.expectedRequestID, requestID)
			}
		})
	}
}
