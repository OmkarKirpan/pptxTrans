package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"
	"time"

	"audit-service/internal/domain"
	"audit-service/internal/repository"
	"audit-service/mocks"
	"audit-service/pkg/cache"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"go.uber.org/zap"
)

// Test constants
const (
	testSessionID   = "session-123"
	testUserID      = "user-456"
	testOwnerID     = "owner-789"
	testOtherUserID = "other-user-999"
)

// Helper functions to create test data
func createSampleAuditEntries() []domain.AuditEntry {
	now := time.Now()
	details1, _ := json.Marshal(map[string]interface{}{"slide": 1, "text": "updated"})
	details2, _ := json.Marshal(map[string]interface{}{"slide": 2, "action": "merged"})

	return []domain.AuditEntry{
		{
			ID:        "audit-001",
			SessionID: testSessionID,
			UserID:    testUserID,
			Type:      "edit",
			Timestamp: now.Add(-10 * time.Minute),
			Details:   details1,
		},
		{
			ID:        "audit-002",
			SessionID: testSessionID,
			UserID:    testUserID,
			Type:      "merge",
			Timestamp: now.Add(-5 * time.Minute),
			Details:   details2,
		},
	}
}

func createSampleSession() *repository.Session {
	return &repository.Session{
		ID:     testSessionID,
		UserID: testUserID,
	}
}

func createSampleAuditResponse() *domain.AuditResponse {
	return &domain.AuditResponse{
		TotalCount: 4,
		Items:      createSampleAuditEntries(),
	}
}

func createSamplePaginationParams() domain.PaginationParams {
	return domain.PaginationParams{
		Limit:  10,
		Offset: 0,
	}
}

func createLargePaginationParams() domain.PaginationParams {
	return domain.PaginationParams{
		Limit:  50,
		Offset: 20,
	}
}

func generateAuditEntries(count int, sessionID, userID string) []domain.AuditEntry {
	entries := make([]domain.AuditEntry, count)
	now := time.Now()

	for i := 0; i < count; i++ {
		details, _ := json.Marshal(map[string]interface{}{"slide": i + 1})
		entries[i] = domain.AuditEntry{
			ID:        fmt.Sprintf("audit-%03d", i+1),
			SessionID: sessionID,
			UserID:    userID,
			Type:      "edit",
			Timestamp: now.Add(-time.Duration(i) * time.Minute),
			Details:   details,
		}
	}

	return entries
}

func TestAuditService_GetAuditLogs(t *testing.T) {
	tests := []struct {
		name           string
		sessionID      string
		userID         string
		isShareToken   bool
		pagination     domain.PaginationParams
		setupMocks     func(*mocks.MockAuditRepository)
		expectedResult *domain.AuditResponse
		expectedError  error
	}{
		{
			name:         "success_with_jwt_token",
			sessionID:    testSessionID,
			userID:       testUserID,
			isShareToken: false,
			pagination:   createSamplePaginationParams(),
			setupMocks: func(mockRepo *mocks.MockAuditRepository) {
				// Mock session ownership validation
				mockRepo.On("GetSession", mock.Anything, testSessionID).
					Return(createSampleSession(), nil)

				// Mock audit logs retrieval
				entries := createSampleAuditEntries()
				mockRepo.On("FindBySessionID", mock.Anything, testSessionID, 10, 0).
					Return(entries, 4, nil)
			},
			expectedResult: createSampleAuditResponse(),
			expectedError:  nil,
		},
		{
			name:         "success_with_share_token",
			sessionID:    testSessionID,
			userID:       testUserID,
			isShareToken: true,
			pagination:   createSamplePaginationParams(),
			setupMocks: func(mockRepo *mocks.MockAuditRepository) {
				// Share token - no ownership validation needed
				entries := createSampleAuditEntries()
				mockRepo.On("FindBySessionID", mock.Anything, testSessionID, 10, 0).
					Return(entries, 4, nil)
			},
			expectedResult: createSampleAuditResponse(),
			expectedError:  nil,
		},
		{
			name:         "success_with_pagination",
			sessionID:    testSessionID,
			userID:       testUserID,
			isShareToken: false,
			pagination:   createLargePaginationParams(),
			setupMocks: func(mockRepo *mocks.MockAuditRepository) {
				// Mock session ownership validation
				mockRepo.On("GetSession", mock.Anything, testSessionID).
					Return(createSampleSession(), nil)

				// Mock paginated audit logs retrieval
				entries := generateAuditEntries(30, testSessionID, testUserID)
				mockRepo.On("FindBySessionID", mock.Anything, testSessionID, 50, 20).
					Return(entries[20:], 100, nil)
			},
			expectedResult: &domain.AuditResponse{
				TotalCount: 100,
				Items:      generateAuditEntries(30, testSessionID, testUserID)[20:],
			},
			expectedError: nil,
		},
		{
			name:         "error_forbidden_access",
			sessionID:    testSessionID,
			userID:       testOtherUserID,
			isShareToken: false,
			pagination:   createSamplePaginationParams(),
			setupMocks: func(mockRepo *mocks.MockAuditRepository) {
				// Mock session with different owner
				session := &repository.Session{
					ID:     testSessionID,
					UserID: testUserID, // Owner is testUserID, but requester is testOtherUserID
				}
				mockRepo.On("GetSession", mock.Anything, testSessionID).
					Return(session, nil)
			},
			expectedResult: nil,
			expectedError:  domain.ErrForbidden,
		},
		{
			name:         "error_session_not_found_ownership",
			sessionID:    "non-existent-session",
			userID:       testUserID,
			isShareToken: false,
			pagination:   createSamplePaginationParams(),
			setupMocks: func(mockRepo *mocks.MockAuditRepository) {
				mockRepo.On("GetSession", mock.Anything, "non-existent-session").
					Return(nil, domain.ErrSessionNotFound)
			},
			expectedResult: nil,
			expectedError:  domain.ErrNotFound,
		},
		{
			name:         "error_session_not_found_audit_logs",
			sessionID:    "non-existent-session",
			userID:       testUserID,
			isShareToken: true,
			pagination:   createSamplePaginationParams(),
			setupMocks: func(mockRepo *mocks.MockAuditRepository) {
				mockRepo.On("FindBySessionID", mock.Anything, "non-existent-session", 10, 0).
					Return(nil, 0, domain.ErrSessionNotFound)
			},
			expectedResult: nil,
			expectedError:  domain.ErrNotFound,
		},
		{
			name:         "error_repository_failure",
			sessionID:    testSessionID,
			userID:       testUserID,
			isShareToken: false,
			pagination:   createSamplePaginationParams(),
			setupMocks: func(mockRepo *mocks.MockAuditRepository) {
				mockRepo.On("GetSession", mock.Anything, testSessionID).
					Return(createSampleSession(), nil)

				mockRepo.On("FindBySessionID", mock.Anything, testSessionID, 10, 0).
					Return(nil, 0, errors.New("database connection failed"))
			},
			expectedResult: nil,
			expectedError:  errors.New("failed to fetch audit logs: database connection failed"),
		},
		{
			name:         "error_ownership_validation_failure",
			sessionID:    testSessionID,
			userID:       testUserID,
			isShareToken: false,
			pagination:   createSamplePaginationParams(),
			setupMocks: func(mockRepo *mocks.MockAuditRepository) {
				mockRepo.On("GetSession", mock.Anything, testSessionID).
					Return(nil, errors.New("database connection failed"))
			},
			expectedResult: nil,
			expectedError:  errors.New("failed to get session: database connection failed"),
		},
		{
			name:         "success_empty_results",
			sessionID:    testSessionID,
			userID:       testUserID,
			isShareToken: true,
			pagination:   createSamplePaginationParams(),
			setupMocks: func(mockRepo *mocks.MockAuditRepository) {
				mockRepo.On("FindBySessionID", mock.Anything, testSessionID, 10, 0).
					Return([]domain.AuditEntry{}, 0, nil)
			},
			expectedResult: &domain.AuditResponse{
				TotalCount: 0,
				Items:      []domain.AuditEntry{},
			},
			expectedError: nil,
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

			service := NewAuditService(mockRepo, tokenCache, logger)

			// Configure mocks
			tt.setupMocks(mockRepo)

			// Execute
			result, err := service.GetAuditLogs(
				context.Background(),
				tt.sessionID,
				tt.userID,
				tt.isShareToken,
				tt.pagination,
			)

			// Assert
			if tt.expectedError != nil {
				assert.Error(t, err)
				assert.Nil(t, result)
				// Check error message or type based on test case
				if tt.expectedError == domain.ErrForbidden {
					assert.Equal(t, domain.ErrForbidden, err)
				} else if tt.expectedError == domain.ErrNotFound {
					assert.Equal(t, domain.ErrNotFound, err)
				} else {
					assert.Contains(t, err.Error(), tt.expectedError.Error())
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
				assert.Equal(t, tt.expectedResult.TotalCount, result.TotalCount)
				assert.Equal(t, len(tt.expectedResult.Items), len(result.Items))

				// Verify items if they exist
				if len(tt.expectedResult.Items) > 0 {
					assert.Equal(t, tt.expectedResult.Items[0].ID, result.Items[0].ID)
					assert.Equal(t, tt.expectedResult.Items[0].SessionID, result.Items[0].SessionID)
					assert.Equal(t, tt.expectedResult.Items[0].Type, result.Items[0].Type)
				}
			}

			// Verify all expectations were met
			mockRepo.AssertExpectations(t)
		})
	}
}

func TestAuditService_validateOwnership(t *testing.T) {
	tests := []struct {
		name          string
		sessionID     string
		userID        string
		setupMocks    func(*mocks.MockAuditRepository)
		expectedError error
	}{
		{
			name:      "success_valid_owner",
			sessionID: testSessionID,
			userID:    testUserID,
			setupMocks: func(mockRepo *mocks.MockAuditRepository) {
				mockRepo.On("GetSession", mock.Anything, testSessionID).
					Return(createSampleSession(), nil)
			},
			expectedError: nil,
		},
		{
			name:      "error_forbidden_different_owner",
			sessionID: testSessionID,
			userID:    testOtherUserID,
			setupMocks: func(mockRepo *mocks.MockAuditRepository) {
				mockRepo.On("GetSession", mock.Anything, testSessionID).
					Return(createSampleSession(), nil)
			},
			expectedError: domain.ErrForbidden,
		},
		{
			name:      "error_session_not_found",
			sessionID: "non-existent-session",
			userID:    testUserID,
			setupMocks: func(mockRepo *mocks.MockAuditRepository) {
				mockRepo.On("GetSession", mock.Anything, "non-existent-session").
					Return(nil, domain.ErrSessionNotFound)
			},
			expectedError: domain.ErrNotFound,
		},
		{
			name:      "error_repository_failure",
			sessionID: testSessionID,
			userID:    testUserID,
			setupMocks: func(mockRepo *mocks.MockAuditRepository) {
				mockRepo.On("GetSession", mock.Anything, testSessionID).
					Return(nil, errors.New("database connection failed"))
			},
			expectedError: errors.New("failed to get session: database connection failed"),
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

			service := &auditService{
				repo:   mockRepo,
				cache:  tokenCache,
				logger: logger,
			}

			// Configure mocks
			tt.setupMocks(mockRepo)

			// Execute
			err := service.validateOwnership(context.Background(), tt.sessionID, tt.userID)

			// Assert
			if tt.expectedError != nil {
				assert.Error(t, err)
				if tt.expectedError == domain.ErrForbidden {
					assert.Equal(t, domain.ErrForbidden, err)
				} else if tt.expectedError == domain.ErrNotFound {
					assert.Equal(t, domain.ErrNotFound, err)
				} else {
					assert.Contains(t, err.Error(), tt.expectedError.Error())
				}
			} else {
				assert.NoError(t, err)
			}

			// Verify all expectations were met
			mockRepo.AssertExpectations(t)
		})
	}
}

func TestNewAuditService(t *testing.T) {
	mockRepo := mocks.NewMockAuditRepository(t)
	tokenCache := cache.NewTokenCache(
		5*time.Minute,
		1*time.Minute,
		10*time.Minute,
	)
	logger := zap.NewNop()

	service := NewAuditService(mockRepo, tokenCache, logger)

	assert.NotNil(t, service)
	assert.Implements(t, (*AuditService)(nil), service)
}
