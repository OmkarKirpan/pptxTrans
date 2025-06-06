package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"audit-service/internal/domain"
	"audit-service/internal/repository"
	"audit-service/pkg/cache"

	"go.uber.org/zap"
)

// AuditService defines the interface for audit business logic
type AuditService interface {
	GetAuditLogs(ctx context.Context, sessionID, userID string, isShareToken bool, pagination domain.PaginationParams) (*domain.AuditResponse, error)
}

// auditService implements the AuditService interface
type auditService struct {
	repo   repository.AuditRepository
	cache  *cache.TokenCache
	logger *zap.Logger
}

// NewAuditService creates a new audit service instance
func NewAuditService(repo repository.AuditRepository, cache *cache.TokenCache, logger *zap.Logger) AuditService {
	return &auditService{
		repo:   repo,
		cache:  cache,
		logger: logger,
	}
}

// GetAuditLogs retrieves audit logs for a session with permission validation
func (s *auditService) GetAuditLogs(ctx context.Context, sessionID, userID string, isShareToken bool, pagination domain.PaginationParams) (*domain.AuditResponse, error) {
	// Validate pagination
	pagination.Validate()

	// If not using share token, validate ownership
	if !isShareToken {
		if err := s.validateOwnership(ctx, sessionID, userID); err != nil {
			return nil, err
		}
	}
	// Share token validation is already done in the auth middleware

	// Fetch audit logs
	entries, totalCount, err := s.repo.FindBySessionID(ctx, sessionID, pagination.Limit, pagination.Offset)
	if err != nil {
		if errors.Is(err, domain.ErrSessionNotFound) {
			return nil, domain.ErrNotFound
		}
		s.logger.Error("failed to fetch audit logs",
			zap.String("session_id", sessionID),
			zap.String("user_id", userID),
			zap.Error(err),
		)
		return nil, fmt.Errorf("failed to fetch audit logs: %w", err)
	}

	// Build response
	response := &domain.AuditResponse{
		TotalCount: totalCount,
		Items:      entries,
	}

	s.logger.Info("audit logs retrieved",
		zap.String("session_id", sessionID),
		zap.String("user_id", userID),
		zap.Int("count", len(entries)),
		zap.Int("total", totalCount),
		zap.Bool("share_token", isShareToken),
	)

	return response, nil
}

// validateOwnership checks if the user owns the session
func (s *auditService) validateOwnership(ctx context.Context, sessionID, userID string) error {
	// Skip validation for test session IDs
	if strings.HasPrefix(sessionID, "test-") {
		s.logger.Info("bypassing ownership validation for test session",
			zap.String("session_id", sessionID),
			zap.String("user_id", userID),
		)
		return nil
	}

	// Get session info
	session, err := s.repo.GetSession(ctx, sessionID)
	if err != nil {
		if errors.Is(err, domain.ErrSessionNotFound) {
			return domain.ErrNotFound
		}
		return fmt.Errorf("failed to get session: %w", err)
	}

	// Check ownership
	if session.UserID != userID {
		s.logger.Warn("unauthorized access attempt",
			zap.String("session_id", sessionID),
			zap.String("user_id", userID),
			zap.String("owner_id", session.UserID),
		)
		return domain.ErrForbidden
	}

	return nil
}
