package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"audit-service/internal/domain"
	"audit-service/internal/middleware"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"go.uber.org/zap"
)

// MockAuditService implements the AuditService interface for testing
type MockAuditService struct {
	mock.Mock
}

func (m *MockAuditService) GetAuditLogs(ctx context.Context, sessionID, userID string, isShareToken bool, pagination domain.PaginationParams) (*domain.AuditResponse, error) {
	args := m.Called(ctx, sessionID, userID, isShareToken, pagination)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.AuditResponse), args.Error(1)
}

func TestAuditHandler_GetHistory_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Setup mock service
	mockService := new(MockAuditService)
	logger := zap.NewNop()
	handler := NewAuditHandler(mockService, logger)

	// Use valid UUID for session ID
	sessionID := "550e8400-e29b-41d4-a716-446655440000"

	// Expected response
	expectedResponse := &domain.AuditResponse{
		TotalCount: 2,
		Items: []domain.AuditEntry{
			{
				ID:        "entry-1",
				SessionID: sessionID,
				UserID:    "user-456",
				Type:      string(domain.ActionEdit),
				Timestamp: time.Now(),
			},
			{
				ID:        "entry-2",
				SessionID: sessionID,
				UserID:    "user-456",
				Type:      string(domain.ActionView),
				Timestamp: time.Now(),
			},
		},
	}

	// Setup mock expectation
	mockService.On("GetAuditLogs",
		mock.Anything, // context
		sessionID,     // sessionID
		"user-456",    // userID
		false,         // isShareToken
		domain.PaginationParams{Limit: 50, Offset: 0},
	).Return(expectedResponse, nil)

	// Setup request
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/v1/sessions/"+sessionID+"/history", nil)
	c.Set(middleware.RequestIDKey, "test-request-id")
	c.Set(middleware.AuthUserIDKey, "user-456")
	c.Set(middleware.AuthTokenTypeKey, middleware.TokenTypeJWT)
	c.Params = []gin.Param{{Key: "sessionId", Value: sessionID}}

	// Call handler
	handler.GetHistory(c)

	// Assert response
	assert.Equal(t, http.StatusOK, w.Code)

	var response domain.AuditResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, expectedResponse.TotalCount, response.TotalCount)
	assert.Len(t, response.Items, 2)

	mockService.AssertExpectations(t)
}

func TestAuditHandler_GetHistory_InvalidSessionID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mockService := new(MockAuditService)
	logger := zap.NewNop()
	handler := NewAuditHandler(mockService, logger)

	// Setup request with invalid session ID
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/v1/sessions/invalid-uuid/history", nil)
	c.Set(middleware.RequestIDKey, "test-request-id")
	c.Params = []gin.Param{{Key: "sessionId", Value: "invalid-uuid"}}

	// Call handler
	handler.GetHistory(c)

	// Assert response
	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response domain.APIError
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "bad_request", response.Code)

	// Service should not be called
	mockService.AssertNotCalled(t, "GetAuditLogs")
}

func TestAuditHandler_GetHistory_ServiceError(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mockService := new(MockAuditService)
	logger := zap.NewNop()
	handler := NewAuditHandler(mockService, logger)

	// Setup mock expectation with error
	mockService.On("GetAuditLogs",
		mock.Anything,
		"550e8400-e29b-41d4-a716-446655440000",
		"user-456",
		false,
		domain.PaginationParams{Limit: 50, Offset: 0},
	).Return(nil, domain.ErrNotFound)

	// Setup request
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/v1/sessions/550e8400-e29b-41d4-a716-446655440000/history", nil)
	c.Set(middleware.RequestIDKey, "test-request-id")
	c.Set(middleware.AuthUserIDKey, "user-456")
	c.Set(middleware.AuthTokenTypeKey, middleware.TokenTypeJWT)
	c.Params = []gin.Param{{Key: "sessionId", Value: "550e8400-e29b-41d4-a716-446655440000"}}

	// Call handler
	handler.GetHistory(c)

	// Assert response
	assert.Equal(t, http.StatusNotFound, w.Code)

	var response domain.APIError
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "not_found", response.Code)

	mockService.AssertExpectations(t)
}

func TestAuditHandler_GetHistory_WithPagination(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mockService := new(MockAuditService)
	logger := zap.NewNop()
	handler := NewAuditHandler(mockService, logger)

	expectedResponse := &domain.AuditResponse{
		TotalCount: 100,
		Items:      []domain.AuditEntry{},
	}

	// Setup mock expectation with custom pagination
	mockService.On("GetAuditLogs",
		mock.Anything,
		"550e8400-e29b-41d4-a716-446655440000",
		"user-456",
		false,
		domain.PaginationParams{Limit: 25, Offset: 50},
	).Return(expectedResponse, nil)

	// Setup request with pagination
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/v1/sessions/550e8400-e29b-41d4-a716-446655440000/history?limit=25&offset=50", nil)
	c.Set(middleware.RequestIDKey, "test-request-id")
	c.Set(middleware.AuthUserIDKey, "user-456")
	c.Set(middleware.AuthTokenTypeKey, middleware.TokenTypeJWT)
	c.Params = []gin.Param{{Key: "sessionId", Value: "550e8400-e29b-41d4-a716-446655440000"}}

	// Call handler
	handler.GetHistory(c)

	// Assert response
	assert.Equal(t, http.StatusOK, w.Code)

	mockService.AssertExpectations(t)
}

func TestIsValidUUID(t *testing.T) {
	tests := []struct {
		name  string
		uuid  string
		valid bool
	}{
		{
			name:  "valid UUID",
			uuid:  "550e8400-e29b-41d4-a716-446655440000",
			valid: true,
		},
		{
			name:  "valid UUID with uppercase",
			uuid:  "550E8400-E29B-41D4-A716-446655440000",
			valid: true,
		},
		{
			name:  "invalid length",
			uuid:  "550e8400-e29b-41d4-a716",
			valid: false,
		},
		{
			name:  "missing hyphens",
			uuid:  "550e8400e29b41d4a716446655440000",
			valid: false,
		},
		{
			name:  "invalid characters",
			uuid:  "550e8400-e29b-41d4-a716-44665544000g",
			valid: false,
		},
		{
			name:  "empty string",
			uuid:  "",
			valid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isValidUUID(tt.uuid)
			assert.Equal(t, tt.valid, result)
		})
	}
}
