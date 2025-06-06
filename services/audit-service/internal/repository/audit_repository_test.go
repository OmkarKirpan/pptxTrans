package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"
	"time"

	"audit-service/internal/domain"

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
	testShareToken  = "share-token-abc"
)

// Helper functions to create test data
func createTestAuditEntries() []domain.AuditEntry {
	baseTime := time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC)
	details1, _ := json.Marshal(map[string]interface{}{"slide": 1, "text": "updated"})
	details2, _ := json.Marshal(map[string]interface{}{"slide": 2, "action": "merged"})

	return []domain.AuditEntry{
		{
			ID:        "audit-001",
			SessionID: testSessionID,
			UserID:    testUserID,
			Type:      "edit",
			Timestamp: baseTime.Add(-10 * time.Minute),
			Details:   details1,
		},
		{
			ID:        "audit-002",
			SessionID: testSessionID,
			UserID:    testUserID,
			Type:      "merge",
			Timestamp: baseTime.Add(-5 * time.Minute),
			Details:   details2,
		},
	}
}

func createTestSession() *Session {
	return &Session{
		ID:     testSessionID,
		UserID: testOwnerID,
	}
}

func generateTestAuditEntries(count int, sessionID, userID string) []domain.AuditEntry {
	entries := make([]domain.AuditEntry, count)
	baseTime := time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC)

	for i := 0; i < count; i++ {
		details, _ := json.Marshal(map[string]interface{}{"slide": i + 1})
		entries[i] = domain.AuditEntry{
			ID:        fmt.Sprintf("audit-%03d", i+1),
			SessionID: sessionID,
			UserID:    userID,
			Type:      "edit",
			Timestamp: baseTime.Add(-time.Duration(i) * time.Minute),
			Details:   details,
		}
	}

	return entries
}

// MockSupabaseClient for testing
type MockSupabaseClient struct {
	mock.Mock
}

func (m *MockSupabaseClient) Get(ctx context.Context, endpoint string, params map[string]string) ([]byte, int, error) {
	args := m.Called(ctx, endpoint, params)
	return args.Get(0).([]byte), args.Int(1), args.Error(2)
}

func (m *MockSupabaseClient) Post(ctx context.Context, endpoint string, payload interface{}) ([]byte, error) {
	args := m.Called(ctx, endpoint, payload)
	return args.Get(0).([]byte), args.Error(1)
}

func TestAuditRepository_FindBySessionID(t *testing.T) {
	tests := []struct {
		name           string
		sessionID      string
		limit          int
		offset         int
		setupMocks     func(*MockSupabaseClient)
		expectedResult []domain.AuditEntry
		expectedCount  int
		expectedError  error
	}{
		{
			name:      "success_fetch_audit_logs",
			sessionID: testSessionID,
			limit:     10,
			offset:    0,
			setupMocks: func(mockClient *MockSupabaseClient) {
				entries := createTestAuditEntries()
				data, _ := json.Marshal(entries)

				expectedParams := map[string]string{
					"session_id": "eq." + testSessionID,
					"order":      "timestamp.desc",
					"limit":      "10",
					"offset":     "0",
					"select":     "*",
				}

				mockClient.On("Get", mock.Anything, "/audit_logs", expectedParams).
					Return(data, 4, nil)
			},
			expectedResult: createTestAuditEntries(),
			expectedCount:  4,
			expectedError:  nil,
		},
		{
			name:      "success_with_pagination",
			sessionID: testSessionID,
			limit:     50,
			offset:    20,
			setupMocks: func(mockClient *MockSupabaseClient) {
				entries := generateTestAuditEntries(30, testSessionID, testUserID)
				data, _ := json.Marshal(entries[20:])

				expectedParams := map[string]string{
					"session_id": "eq." + testSessionID,
					"order":      "timestamp.desc",
					"limit":      "50",
					"offset":     "20",
					"select":     "*",
				}

				mockClient.On("Get", mock.Anything, "/audit_logs", expectedParams).
					Return(data, 100, nil)
			},
			expectedResult: generateTestAuditEntries(30, testSessionID, testUserID)[20:],
			expectedCount:  100,
			expectedError:  nil,
		},
		{
			name:      "success_empty_results",
			sessionID: testSessionID,
			limit:     10,
			offset:    0,
			setupMocks: func(mockClient *MockSupabaseClient) {
				data, _ := json.Marshal([]domain.AuditEntry{})

				expectedParams := map[string]string{
					"session_id": "eq." + testSessionID,
					"order":      "timestamp.desc",
					"limit":      "10",
					"offset":     "0",
					"select":     "*",
				}

				mockClient.On("Get", mock.Anything, "/audit_logs", expectedParams).
					Return(data, 0, nil)
			},
			expectedResult: []domain.AuditEntry{},
			expectedCount:  0,
			expectedError:  nil,
		},
		{
			name:      "error_client_failure",
			sessionID: testSessionID,
			limit:     10,
			offset:    0,
			setupMocks: func(mockClient *MockSupabaseClient) {
				expectedParams := map[string]string{
					"session_id": "eq." + testSessionID,
					"order":      "timestamp.desc",
					"limit":      "10",
					"offset":     "0",
					"select":     "*",
				}

				mockClient.On("Get", mock.Anything, "/audit_logs", expectedParams).
					Return([]byte{}, 0, errors.New("network error"))
			},
			expectedResult: nil,
			expectedCount:  0,
			expectedError:  errors.New("failed to fetch audit logs: network error"),
		},
		{
			name:      "error_json_parse_failure",
			sessionID: testSessionID,
			limit:     10,
			offset:    0,
			setupMocks: func(mockClient *MockSupabaseClient) {
				invalidJSON := []byte(`{"invalid": json}`)

				expectedParams := map[string]string{
					"session_id": "eq." + testSessionID,
					"order":      "timestamp.desc",
					"limit":      "10",
					"offset":     "0",
					"select":     "*",
				}

				mockClient.On("Get", mock.Anything, "/audit_logs", expectedParams).
					Return(invalidJSON, 0, nil)
			},
			expectedResult: nil,
			expectedCount:  0,
			expectedError:  errors.New("failed to parse audit logs"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			mockClient := &MockSupabaseClient{}
			logger := zap.NewNop()
			repo := NewAuditRepository(mockClient, logger)

			// Configure mocks
			tt.setupMocks(mockClient)

			// Execute
			result, count, err := repo.FindBySessionID(context.Background(), tt.sessionID, tt.limit, tt.offset)

			// Assert
			if tt.expectedError != nil {
				assert.Error(t, err)
				assert.Nil(t, result)
				assert.Equal(t, 0, count)
				assert.Contains(t, err.Error(), tt.expectedError.Error())
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedResult, result)
				assert.Equal(t, tt.expectedCount, count)
			}

			// Verify all expectations were met
			mockClient.AssertExpectations(t)
		})
	}
}

func TestAuditRepository_GetSession(t *testing.T) {
	tests := []struct {
		name           string
		sessionID      string
		setupMocks     func(*MockSupabaseClient)
		expectedResult *Session
		expectedError  error
	}{
		{
			name:      "success_session_found",
			sessionID: testSessionID,
			setupMocks: func(mockClient *MockSupabaseClient) {
				session := createTestSession()
				sessions := []Session{*session}
				data, _ := json.Marshal(sessions)

				expectedParams := map[string]string{
					"id":     "eq." + testSessionID,
					"select": "id,user_id",
					"limit":  "1",
				}

				mockClient.On("Get", mock.Anything, "/sessions", expectedParams).
					Return(data, 1, nil)
			},
			expectedResult: createTestSession(),
			expectedError:  nil,
		},
		{
			name:      "error_session_not_found",
			sessionID: "non-existent-session",
			setupMocks: func(mockClient *MockSupabaseClient) {
				data, _ := json.Marshal([]Session{})

				expectedParams := map[string]string{
					"id":     "eq.non-existent-session",
					"select": "id,user_id",
					"limit":  "1",
				}

				mockClient.On("Get", mock.Anything, "/sessions", expectedParams).
					Return(data, 0, nil)
			},
			expectedResult: nil,
			expectedError:  domain.ErrSessionNotFound,
		},
		{
			name:      "error_client_failure",
			sessionID: testSessionID,
			setupMocks: func(mockClient *MockSupabaseClient) {
				expectedParams := map[string]string{
					"id":     "eq." + testSessionID,
					"select": "id,user_id",
					"limit":  "1",
				}

				mockClient.On("Get", mock.Anything, "/sessions", expectedParams).
					Return([]byte{}, 0, errors.New("database error"))
			},
			expectedResult: nil,
			expectedError:  errors.New("failed to fetch session: database error"),
		},
		{
			name:      "error_json_parse_failure",
			sessionID: testSessionID,
			setupMocks: func(mockClient *MockSupabaseClient) {
				invalidJSON := []byte(`{"invalid": json}`)

				expectedParams := map[string]string{
					"id":     "eq." + testSessionID,
					"select": "id,user_id",
					"limit":  "1",
				}

				mockClient.On("Get", mock.Anything, "/sessions", expectedParams).
					Return(invalidJSON, 0, nil)
			},
			expectedResult: nil,
			expectedError:  errors.New("failed to parse session"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			mockClient := &MockSupabaseClient{}
			logger := zap.NewNop()
			repo := NewAuditRepository(mockClient, logger)

			// Configure mocks
			tt.setupMocks(mockClient)

			// Execute
			result, err := repo.GetSession(context.Background(), tt.sessionID)

			// Assert
			if tt.expectedError != nil {
				assert.Error(t, err)
				assert.Nil(t, result)
				if tt.expectedError == domain.ErrSessionNotFound {
					assert.Equal(t, domain.ErrSessionNotFound, err)
				} else {
					assert.Contains(t, err.Error(), tt.expectedError.Error())
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
				assert.Equal(t, tt.expectedResult.ID, result.ID)
				assert.Equal(t, tt.expectedResult.UserID, result.UserID)
			}

			// Verify all expectations were met
			mockClient.AssertExpectations(t)
		})
	}
}

func TestAuditRepository_ValidateShareToken(t *testing.T) {
	tests := []struct {
		name          string
		token         string
		sessionID     string
		setupMocks    func(*MockSupabaseClient)
		expectedValid bool
		expectedError error
	}{
		{
			name:      "success_valid_token",
			token:     testShareToken,
			sessionID: testSessionID,
			setupMocks: func(mockClient *MockSupabaseClient) {
				shareToken := ShareToken{
					Token:     testShareToken,
					SessionID: testSessionID,
				}
				shares := []ShareToken{shareToken}
				data, _ := json.Marshal(shares)

				expectedParams := map[string]string{
					"token":      "eq." + testShareToken,
					"session_id": "eq." + testSessionID,
					"select":     "token,session_id,expires_at",
					"limit":      "1",
				}

				mockClient.On("Get", mock.Anything, "/session_shares", expectedParams).
					Return(data, 1, nil)
			},
			expectedValid: true,
			expectedError: nil,
		},
		{
			name:      "invalid_token_not_found",
			token:     "invalid-token",
			sessionID: testSessionID,
			setupMocks: func(mockClient *MockSupabaseClient) {
				data, _ := json.Marshal([]ShareToken{})

				expectedParams := map[string]string{
					"token":      "eq.invalid-token",
					"session_id": "eq." + testSessionID,
					"select":     "token,session_id,expires_at",
					"limit":      "1",
				}

				mockClient.On("Get", mock.Anything, "/session_shares", expectedParams).
					Return(data, 0, nil)
			},
			expectedValid: false,
			expectedError: nil,
		},
		{
			name:      "error_client_failure",
			token:     testShareToken,
			sessionID: testSessionID,
			setupMocks: func(mockClient *MockSupabaseClient) {
				expectedParams := map[string]string{
					"token":      "eq." + testShareToken,
					"session_id": "eq." + testSessionID,
					"select":     "token,session_id,expires_at",
					"limit":      "1",
				}

				mockClient.On("Get", mock.Anything, "/session_shares", expectedParams).
					Return([]byte{}, 0, errors.New("network error"))
			},
			expectedValid: false,
			expectedError: errors.New("failed to validate share token: network error"),
		},
		{
			name:      "error_json_parse_failure",
			token:     testShareToken,
			sessionID: testSessionID,
			setupMocks: func(mockClient *MockSupabaseClient) {
				invalidJSON := []byte(`{"invalid": json}`)

				expectedParams := map[string]string{
					"token":      "eq." + testShareToken,
					"session_id": "eq." + testSessionID,
					"select":     "token,session_id,expires_at",
					"limit":      "1",
				}

				mockClient.On("Get", mock.Anything, "/session_shares", expectedParams).
					Return(invalidJSON, 0, nil)
			},
			expectedValid: false,
			expectedError: errors.New("failed to parse share token"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			mockClient := &MockSupabaseClient{}
			logger := zap.NewNop()
			repo := NewAuditRepository(mockClient, logger)

			// Configure mocks
			tt.setupMocks(mockClient)

			// Execute
			valid, err := repo.ValidateShareToken(context.Background(), tt.token, tt.sessionID)

			// Assert
			if tt.expectedError != nil {
				assert.Error(t, err)
				assert.False(t, valid)
				assert.Contains(t, err.Error(), tt.expectedError.Error())
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedValid, valid)
			}

			// Verify all expectations were met
			mockClient.AssertExpectations(t)
		})
	}
}

func TestNewAuditRepository(t *testing.T) {
	mockClient := &MockSupabaseClient{}
	logger := zap.NewNop()

	repo := NewAuditRepository(mockClient, logger)

	assert.NotNil(t, repo)
	assert.Implements(t, (*AuditRepository)(nil), repo)
}
