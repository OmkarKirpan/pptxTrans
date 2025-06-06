package domain

import (
	"encoding/json"
	"time"
)

// CreateEventRequest represents the request to create a new audit event
type CreateEventRequest struct {
	SessionID string                 `json:"sessionId" example:"550e8400-e29b-41d4-a716-446655440001" binding:"required"`
	Type      string                 `json:"type" example:"edit" binding:"required"`
	Details   map[string]interface{} `json:"details,omitempty" swaggertype:"object"`
}

// AuditEvent represents an event in the audit log
type AuditEvent struct {
	ID        string                 `json:"id"`
	SessionID string                 `json:"sessionId"`
	UserID    string                 `json:"userId"`
	Type      string                 `json:"type"`
	Details   map[string]interface{} `json:"details,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
}

// AuditEntry represents a single audit log entry
type AuditEntry struct {
	ID        string          `json:"id" example:"550e8400-e29b-41d4-a716-446655440000"`
	SessionID string          `json:"sessionId" example:"550e8400-e29b-41d4-a716-446655440001"`
	UserID    string          `json:"userId" example:"550e8400-e29b-41d4-a716-446655440002"`
	Type      string          `json:"type" example:"edit"`
	Timestamp time.Time       `json:"timestamp" example:"2023-12-01T10:30:00Z"`
	Details   json.RawMessage `json:"details,omitempty" swaggertype:"object"`
	IPAddress string          `json:"ipAddress,omitempty" example:"192.168.1.1"`
	UserAgent string          `json:"userAgent,omitempty" example:"Mozilla/5.0"`
}

// AuditResponse represents the paginated audit log response
type AuditResponse struct {
	TotalCount int          `json:"totalCount" example:"42"`
	Items      []AuditEntry `json:"items"`
}

// AuditAction represents the type of action performed
type AuditAction string

// Common audit actions
const (
	ActionCreate  AuditAction = "create"
	ActionEdit    AuditAction = "edit"
	ActionMerge   AuditAction = "merge"
	ActionReorder AuditAction = "reorder"
	ActionComment AuditAction = "comment"
	ActionExport  AuditAction = "export"
	ActionShare   AuditAction = "share"
	ActionUnshare AuditAction = "unshare"
	ActionView    AuditAction = "view"
)

// PaginationParams defines pagination parameters
type PaginationParams struct {
	Limit  int
	Offset int
}

// Validate ensures pagination parameters are within acceptable ranges
func (p *PaginationParams) Validate() {
	if p.Limit <= 0 {
		p.Limit = 50 // Default limit
	} else if p.Limit > 100 {
		p.Limit = 100 // Maximum limit
	}

	if p.Offset < 0 {
		p.Offset = 0 // Minimum offset
	}
}
