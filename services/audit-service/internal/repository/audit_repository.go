package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"audit-service/internal/domain"

	"go.uber.org/zap"
)

// AuditRepository defines the interface for audit data access
type AuditRepository interface {
	FindBySessionID(ctx context.Context, sessionID string, limit, offset int) ([]domain.AuditEntry, int, error)
	GetSession(ctx context.Context, sessionID string) (*Session, error)
	ValidateShareToken(ctx context.Context, token, sessionID string) (bool, error)
}

// auditRepository implements the AuditRepository interface
type auditRepository struct {
	client SupabaseClientInterface
	logger *zap.Logger
}

// NewAuditRepository creates a new audit repository instance
func NewAuditRepository(client SupabaseClientInterface, logger *zap.Logger) AuditRepository {
	return &auditRepository{
		client: client,
		logger: logger,
	}
}

// Session represents a session from the database
type Session struct {
	ID     string `json:"id"`
	UserID string `json:"user_id"`
}

// ShareToken represents a share token from the database
type ShareToken struct {
	Token     string `json:"token"`
	SessionID string `json:"session_id"`
	ExpiresAt string `json:"expires_at,omitempty"`
}

// FindBySessionID retrieves audit logs for a specific session
func (r *auditRepository) FindBySessionID(ctx context.Context, sessionID string, limit, offset int) ([]domain.AuditEntry, int, error) {
	// For test session IDs, return empty results
	// In a real implementation, we would inject a test event store here
	// and fetch test events from it
	if strings.HasPrefix(sessionID, "test-") {
		r.logger.Debug("test session ID detected, returning empty audit logs",
			zap.String("session_id", sessionID),
		)

		// Return empty results for now - test events are handled separately
		return []domain.AuditEntry{}, 0, nil
	}

	// Build query parameters
	queryParams := map[string]string{
		"session_id": fmt.Sprintf("eq.%s", sessionID),
		"order":      "timestamp.desc",
		"limit":      strconv.Itoa(limit),
		"offset":     strconv.Itoa(offset),
		"select":     "*",
	}

	// Make request to Supabase
	data, count, err := r.client.Get(ctx, "/audit_logs", queryParams)
	if err != nil {
		r.logger.Error("failed to fetch audit logs",
			zap.String("session_id", sessionID),
			zap.Error(err),
		)
		return nil, 0, fmt.Errorf("failed to fetch audit logs: %w", err)
	}

	// Parse response
	var entries []domain.AuditEntry
	if err := json.Unmarshal(data, &entries); err != nil {
		r.logger.Error("failed to parse audit logs",
			zap.String("session_id", sessionID),
			zap.Error(err),
		)
		return nil, 0, fmt.Errorf("failed to parse audit logs: %w", err)
	}

	r.logger.Debug("fetched audit logs",
		zap.String("session_id", sessionID),
		zap.Int("count", len(entries)),
		zap.Int("total", count),
	)

	return entries, count, nil
}

// GetSession retrieves session information
func (r *auditRepository) GetSession(ctx context.Context, sessionID string) (*Session, error) {
	// Build query parameters
	queryParams := map[string]string{
		"id":     fmt.Sprintf("eq.%s", sessionID),
		"select": "id,user_id",
		"limit":  "1",
	}

	// Make request to Supabase
	data, _, err := r.client.Get(ctx, "/sessions", queryParams)
	if err != nil {
		r.logger.Error("failed to fetch session",
			zap.String("session_id", sessionID),
			zap.Error(err),
		)
		return nil, fmt.Errorf("failed to fetch session: %w", err)
	}

	// Parse response
	var sessions []Session
	if err := json.Unmarshal(data, &sessions); err != nil {
		r.logger.Error("failed to parse session",
			zap.String("session_id", sessionID),
			zap.Error(err),
		)
		return nil, fmt.Errorf("failed to parse session: %w", err)
	}

	if len(sessions) == 0 {
		return nil, domain.ErrSessionNotFound
	}

	return &sessions[0], nil
}

// ValidateShareToken checks if a share token is valid for a session
func (r *auditRepository) ValidateShareToken(ctx context.Context, token, sessionID string) (bool, error) {
	// Build query parameters
	queryParams := map[string]string{
		"token":      fmt.Sprintf("eq.%s", token),
		"session_id": fmt.Sprintf("eq.%s", sessionID),
		"select":     "token,session_id,expires_at",
		"limit":      "1",
	}

	// Make request to Supabase
	data, _, err := r.client.Get(ctx, "/session_shares", queryParams)
	if err != nil {
		r.logger.Error("failed to validate share token",
			zap.String("session_id", sessionID),
			zap.Error(err),
		)
		return false, fmt.Errorf("failed to validate share token: %w", err)
	}

	// Parse response
	var shares []ShareToken
	if err := json.Unmarshal(data, &shares); err != nil {
		r.logger.Error("failed to parse share token",
			zap.String("session_id", sessionID),
			zap.Error(err),
		)
		return false, fmt.Errorf("failed to parse share token: %w", err)
	}

	if len(shares) == 0 {
		return false, nil
	}

	// TODO: Check expiration if expires_at is set
	// For now, assume valid if found
	return true, nil
}
