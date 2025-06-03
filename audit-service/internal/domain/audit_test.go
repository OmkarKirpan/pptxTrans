package domain

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestAuditEntry_JSONSerialization(t *testing.T) {
	// Create test audit entry
	entry := AuditEntry{
		ID:        "test-id",
		SessionID: "session-123",
		UserID:    "user-456",
		Type:      string(ActionEdit),
		Timestamp: time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC),
		Details:   json.RawMessage(`{"field": "value"}`),
		IPAddress: "192.168.1.1",
		UserAgent: "test-agent",
	}

	// Test JSON marshaling
	data, err := json.Marshal(entry)
	assert.NoError(t, err)
	assert.Contains(t, string(data), "test-id")
	assert.Contains(t, string(data), "session-123")
	assert.Contains(t, string(data), "edit")

	// Test JSON unmarshaling
	var unmarshaled AuditEntry
	err = json.Unmarshal(data, &unmarshaled)
	assert.NoError(t, err)
	assert.Equal(t, entry.ID, unmarshaled.ID)
	assert.Equal(t, entry.SessionID, unmarshaled.SessionID)
	assert.Equal(t, entry.Type, unmarshaled.Type)
}

func TestPaginationParams_Validate(t *testing.T) {
	tests := []struct {
		name     string
		input    PaginationParams
		expected PaginationParams
	}{
		{
			name:     "default values when zero",
			input:    PaginationParams{Limit: 0, Offset: 0},
			expected: PaginationParams{Limit: 50, Offset: 0},
		},
		{
			name:     "limit exceeds maximum",
			input:    PaginationParams{Limit: 200, Offset: 10},
			expected: PaginationParams{Limit: 100, Offset: 10},
		},
		{
			name:     "negative offset corrected",
			input:    PaginationParams{Limit: 25, Offset: -10},
			expected: PaginationParams{Limit: 25, Offset: 0},
		},
		{
			name:     "valid values unchanged",
			input:    PaginationParams{Limit: 25, Offset: 10},
			expected: PaginationParams{Limit: 25, Offset: 10},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pagination := tt.input
			pagination.Validate()
			assert.Equal(t, tt.expected, pagination)
		})
	}
}

func TestAuditAction_Constants(t *testing.T) {
	// Test that all action constants are defined
	actionTypes := []AuditAction{
		ActionCreate,
		ActionEdit,
		ActionMerge,
		ActionReorder,
		ActionComment,
		ActionExport,
		ActionShare,
		ActionUnshare,
		ActionView,
	}

	for _, actionType := range actionTypes {
		assert.NotEmpty(t, string(actionType))
		assert.IsType(t, AuditAction(""), actionType)
	}
}

func TestAuditResponse_Structure(t *testing.T) {
	// Test AuditResponse structure
	entries := []AuditEntry{
		{
			ID:        "entry-1",
			SessionID: "session-123",
			UserID:    "user-456",
			Type:      string(ActionEdit),
			Timestamp: time.Now(),
		},
		{
			ID:        "entry-2",
			SessionID: "session-123",
			UserID:    "user-456",
			Type:      string(ActionView),
			Timestamp: time.Now(),
		},
	}

	response := AuditResponse{
		TotalCount: 10,
		Items:      entries,
	}

	// Test JSON serialization
	data, err := json.Marshal(response)
	assert.NoError(t, err)
	assert.Contains(t, string(data), "totalCount")
	assert.Contains(t, string(data), "items")

	// Test deserialization
	var unmarshaled AuditResponse
	err = json.Unmarshal(data, &unmarshaled)
	assert.NoError(t, err)
	assert.Equal(t, response.TotalCount, unmarshaled.TotalCount)
	assert.Len(t, unmarshaled.Items, 2)
}
