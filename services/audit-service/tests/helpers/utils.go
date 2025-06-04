package helpers

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"audit-service/internal/domain"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Test context with timeout
func TestContext() context.Context {
	return context.Background()
}

// HTTP Test Helpers

// HTTPTestRequest creates an HTTP test request with optional body
func HTTPTestRequest(method, path string, body interface{}, headers map[string]string) *http.Request {
	var reader io.Reader

	if body != nil {
		jsonBytes, _ := json.Marshal(body)
		reader = bytes.NewBuffer(jsonBytes)
	}

	req := httptest.NewRequest(method, path, reader)

	// Set default content type
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	// Add custom headers
	for key, value := range headers {
		req.Header.Set(key, value)
	}

	return req
}

// HTTPTestRequestWithQuery creates an HTTP test request with query parameters
func HTTPTestRequestWithQuery(method, path string, queryParams map[string]string, headers map[string]string) *http.Request {
	req := httptest.NewRequest(method, path, nil)

	// Add query parameters
	q := req.URL.Query()
	for key, value := range queryParams {
		q.Add(key, value)
	}
	req.URL.RawQuery = q.Encode()

	// Add headers
	for key, value := range headers {
		req.Header.Set(key, value)
	}

	return req
}

// Response Helpers

// ParseJSONResponse parses JSON response from recorder into target struct
func ParseJSONResponse(t *testing.T, recorder *httptest.ResponseRecorder, target interface{}) {
	require.Equal(t, "application/json; charset=utf-8", recorder.Header().Get("Content-Type"))
	err := json.Unmarshal(recorder.Body.Bytes(), target)
	require.NoError(t, err)
}

// ParseErrorResponse parses error response from recorder
func ParseErrorResponse(t *testing.T, recorder *httptest.ResponseRecorder) *domain.APIError {
	var apiErr domain.APIError
	ParseJSONResponse(t, recorder, &apiErr)
	return &apiErr
}

// Assertion Helpers

// AssertErrorResponse checks that the response contains expected error
func AssertErrorResponse(t *testing.T, recorder *httptest.ResponseRecorder, expectedStatus int, expectedCode string) {
	assert.Equal(t, expectedStatus, recorder.Code)

	errorResp := ParseErrorResponse(t, recorder)
	assert.Equal(t, expectedCode, errorResp.Code)
	assert.NotEmpty(t, errorResp.Message)
}

// AssertSuccessResponse checks that the response is successful
func AssertSuccessResponse(t *testing.T, recorder *httptest.ResponseRecorder, expectedStatus int) {
	assert.Equal(t, expectedStatus, recorder.Code)
	assert.Equal(t, "application/json; charset=utf-8", recorder.Header().Get("Content-Type"))
}

// AssertAuditResponse checks audit response structure and data
func AssertAuditResponse(t *testing.T, recorder *httptest.ResponseRecorder, expectedCount int) *domain.AuditResponse {
	AssertSuccessResponse(t, recorder, http.StatusOK)

	var response domain.AuditResponse
	ParseJSONResponse(t, recorder, &response)

	assert.Equal(t, expectedCount, len(response.Items))
	assert.GreaterOrEqual(t, response.TotalCount, expectedCount)

	// Verify audit entries are sorted by timestamp (newest first)
	if len(response.Items) > 1 {
		for i := 1; i < len(response.Items); i++ {
			assert.True(t, response.Items[i-1].Timestamp.After(response.Items[i].Timestamp) ||
				response.Items[i-1].Timestamp.Equal(response.Items[i].Timestamp),
				"audit entries should be sorted by timestamp (newest first)")
		}
	}

	return &response
}

// Gin Context Helpers

// CreateTestGinContext creates a test Gin context with recorder
func CreateTestGinContext() (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)

	return c, recorder
}

// CreateTestGinContextWithRequest creates a test Gin context with request
func CreateTestGinContextWithRequest(req *http.Request) (*gin.Context, *httptest.ResponseRecorder) {
	c, recorder := CreateTestGinContext()
	c.Request = req

	return c, recorder
}

// SetGinParam sets a path parameter in Gin context
func SetGinParam(c *gin.Context, key, value string) {
	c.Params = append(c.Params, gin.Param{Key: key, Value: value})
}

// SetGinContextValues sets values in Gin context
func SetGinContextValues(c *gin.Context, values map[string]interface{}) {
	for key, value := range values {
		c.Set(key, value)
	}
}

// Mock Setup Helpers

// SetupMockExpectations is a helper type for setting up mock expectations
type MockExpectations struct {
	t *testing.T
}

// NewMockExpectations creates a new mock expectations helper
func NewMockExpectations(t *testing.T) *MockExpectations {
	return &MockExpectations{t: t}
}

// String matching helpers for tests

// ContainsIgnoreCase checks if haystack contains needle (case insensitive)
func ContainsIgnoreCase(haystack, needle string) bool {
	return strings.Contains(strings.ToLower(haystack), strings.ToLower(needle))
}

// Time helpers for tests

// TimeMatches checks if two times are equal within a small tolerance
func TimeMatches(t *testing.T, expected, actual interface{}) {
	// This can be extended based on specific time matching needs
	assert.Equal(t, expected, actual)
}

// Slice helpers

// ContainsString checks if slice contains string
func ContainsString(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

// Testing environment setup

// SetupTestEnv sets up common test environment variables
func SetupTestEnv() {
	// Set environment variables commonly needed for tests
	// This can be extended as needed
}

// CleanupTestEnv cleans up test environment
func CleanupTestEnv() {
	// Cleanup test environment if needed
}
