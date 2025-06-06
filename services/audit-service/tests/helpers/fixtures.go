package helpers

import (
	"encoding/json"
	"fmt"
	"time"

	"audit-service/internal/domain"
	"audit-service/internal/repository"
	pkgjwt "audit-service/pkg/jwt"

	"github.com/golang-jwt/jwt/v5"
)

// Test constants
const (
	TestSessionID   = "550e8400-e29b-41d4-a716-446655440000"
	TestUserID      = "123e4567-e89b-12d3-a456-426614174000"
	TestOwnerID     = "123e4567-e89b-12d3-a456-426614174000"
	TestOtherUserID = "223e4567-e89b-12d3-a456-426614174000"
	TestShareToken  = "share-token-123"
	TestJWTSecret   = "your-test-jwt-secret"
)

// Helper function to create json.RawMessage from interface{}
func toRawMessage(data interface{}) json.RawMessage {
	bytes, _ := json.Marshal(data)
	return json.RawMessage(bytes)
}

// Sample audit entries for testing
func SampleAuditEntries() []domain.AuditEntry {
	baseTime := time.Date(2024, 1, 15, 10, 0, 0, 0, time.UTC)

	return []domain.AuditEntry{
		{
			ID:        "audit-001",
			SessionID: TestSessionID,
			UserID:    TestUserID,
			Type:      "edit",
			Timestamp: baseTime.Add(3 * time.Minute),
			Details:   toRawMessage(map[string]interface{}{"slide": 1, "element": "text"}),
		},
		{
			ID:        "audit-002",
			SessionID: TestSessionID,
			UserID:    TestUserID,
			Type:      "merge",
			Timestamp: baseTime.Add(2 * time.Minute),
			Details:   toRawMessage(map[string]interface{}{"slides": []int{2, 3}}),
		},
		{
			ID:        "audit-003",
			SessionID: TestSessionID,
			UserID:    TestUserID,
			Type:      "comment",
			Timestamp: baseTime.Add(1 * time.Minute),
			Details:   toRawMessage(map[string]interface{}{"slide": 2, "comment": "Review needed"}),
		},
		{
			ID:        "audit-004",
			SessionID: TestSessionID,
			UserID:    TestUserID,
			Type:      "export",
			Timestamp: baseTime,
			Details:   toRawMessage(map[string]interface{}{"format": "pptx"}),
		},
	}
}

// Sample audit response for testing
func SampleAuditResponse() *domain.AuditResponse {
	return &domain.AuditResponse{
		TotalCount: 4,
		Items:      SampleAuditEntries(),
	}
}

// Sample session for testing
func SampleSession() *repository.Session {
	return &repository.Session{
		ID:     TestSessionID,
		UserID: TestOwnerID,
	}
}

// Sample JWT claims for testing
func SampleJWTClaims() *pkgjwt.Claims {
	return &pkgjwt.Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   TestUserID,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-5 * time.Minute)),
			Issuer:    "test-issuer",
		},
		UserID: TestUserID,
	}
}

// Sample expired JWT claims for testing
func ExpiredJWTClaims() *pkgjwt.Claims {
	return &pkgjwt.Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   TestUserID,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)),
			Issuer:    "test-issuer",
		},
		UserID: TestUserID,
	}
}

// Sample pagination params for testing
func SamplePaginationParams() domain.PaginationParams {
	return domain.PaginationParams{
		Limit:  10,
		Offset: 0,
	}
}

// Large pagination params for testing
func LargePaginationParams() domain.PaginationParams {
	return domain.PaginationParams{
		Limit:  50,
		Offset: 20,
	}
}

// Invalid pagination params for testing
func InvalidPaginationParams() domain.PaginationParams {
	return domain.PaginationParams{
		Limit:  -1,
		Offset: -5,
	}
}

// Error scenarios
var (
	// Sample domain errors
	SampleUnauthorizedError = domain.ErrUnauthorized
	SampleForbiddenError    = domain.ErrForbidden
	SampleNotFoundError     = domain.ErrNotFound
	SampleSessionNotFound   = domain.ErrSessionNotFound
)

// Test data generators
func GenerateAuditEntries(count int, sessionID, userID string) []domain.AuditEntry {
	entries := make([]domain.AuditEntry, count)
	baseTime := time.Now().UTC()

	actions := []string{"edit", "merge", "comment", "export", "reorder"}

	for i := 0; i < count; i++ {
		entries[i] = domain.AuditEntry{
			ID:        fmt.Sprintf("audit-%03d", i+1),
			SessionID: sessionID,
			UserID:    userID,
			Type:      actions[i%len(actions)],
			Timestamp: baseTime.Add(-time.Duration(i) * time.Minute),
			Details:   toRawMessage(map[string]interface{}{"test": true, "index": i}),
		}
	}

	return entries
}

// HTTP test data
const (
	ValidJWTToken   = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjNlNDU2Ny1lODliLTEyZDMtYTQ1Ni00MjY2MTQxNzQwMDAiLCJleHAiOjk5OTk5OTk5OTksImlhdCI6MTY0MDk5NTIwMCwiaXNzIjoidGVzdC1pc3N1ZXIifQ.test"
	ExpiredJWTToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjNlNDU2Ny1lODliLTEyZDMtYTQ1Ni00MjY2MTQxNzQwMDAiLCJleHAiOjE2NDA5OTUyMDAsImlhdCI6MTY0MDk5NTIwMCwiaXNzIjoidGVzdC1pc3N1ZXIifQ.test"
	InvalidJWTToken = "invalid.jwt.token"
)

// HTTP headers for testing
func AuthHeaders(token string) map[string]string {
	return map[string]string{
		"Authorization": "Bearer " + token,
		"Content-Type":  "application/json",
	}
}

// Query parameters for testing
func ShareTokenParams(token string) map[string]string {
	return map[string]string{
		"share_token": token,
	}
}

func PaginationParams(limit, offset int) map[string]string {
	return map[string]string{
		"limit":  fmt.Sprintf("%d", limit),
		"offset": fmt.Sprintf("%d", offset),
	}
}
