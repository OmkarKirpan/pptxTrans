package middleware

import (
	"context"
	"strings"
	"time"

	"audit-service/internal/domain"
	"audit-service/internal/repository"
	"audit-service/pkg/cache"
	"audit-service/pkg/jwt"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

const (
	AuthUserIDKey    = "auth_user_id"
	AuthTokenTypeKey = "auth_token_type"
	TokenTypeJWT     = "jwt"
	TokenTypeShare   = "share"
)

// Auth middleware validates JWT tokens or share tokens
func Auth(validator jwt.TokenValidator, tokenCache *cache.TokenCache, repo repository.AuditRepository, logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := GetRequestID(c)

		// Extract session ID from path
		sessionID := c.Param("sessionId")
		if sessionID == "" {
			logger.Warn("missing session ID in path",
				zap.String("request_id", requestID),
			)
			c.JSON(401, domain.APIErrUnauthorized)
			c.Abort()
			return
		}

		// Check for share token first
		shareToken := c.Query("share_token")
		if shareToken != "" {
			// Validate share token
			if validateShareToken(c, shareToken, sessionID, tokenCache, repo, logger) {
				c.Set(AuthTokenTypeKey, TokenTypeShare)
				c.Next()
				return
			}
			// If share token is invalid, don't fall through to JWT
			c.JSON(403, domain.APIErrForbidden)
			c.Abort()
			return
		}

		// Check for JWT token
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			logger.Warn("missing authorization header",
				zap.String("request_id", requestID),
			)
			c.JSON(401, domain.APIErrUnauthorized)
			c.Abort()
			return
		}

		// Extract token from Bearer scheme
		token := extractBearerToken(authHeader)
		if token == "" {
			logger.Warn("invalid authorization header format",
				zap.String("request_id", requestID),
			)
			c.JSON(401, domain.APIErrUnauthorized)
			c.Abort()
			return
		}

		// Validate JWT token
		if !validateJWTToken(c, token, validator, tokenCache, logger) {
			c.JSON(401, domain.APIErrUnauthorized)
			c.Abort()
			return
		}

		c.Set(AuthTokenTypeKey, TokenTypeJWT)
		c.Next()
	}
}

// extractBearerToken extracts the token from the Bearer scheme
func extractBearerToken(authHeader string) string {
	// Trim any leading/trailing whitespace
	authHeader = strings.TrimSpace(authHeader)

	// Check if it starts with "Bearer " (case-insensitive)
	if len(authHeader) < 7 || strings.ToLower(authHeader[:6]) != "bearer" {
		return ""
	}

	// Extract everything after "Bearer " and trim spaces
	token := strings.TrimSpace(authHeader[6:])

	// Token should not be empty
	if token == "" {
		return ""
	}

	return token
}

// validateJWTToken validates a JWT token and caches the result
func validateJWTToken(c *gin.Context, token string, validator jwt.TokenValidator, tokenCache *cache.TokenCache, logger *zap.Logger) bool {
	requestID := GetRequestID(c)

	// Check cache first
	if cached, found := tokenCache.GetJWT(token); found {
		logger.Debug("jwt token found in cache",
			zap.String("request_id", requestID),
			zap.String("user_id", cached.UserID),
		)
		c.Set(AuthUserIDKey, cached.UserID)
		return true
	}

	// Validate token
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	claims, err := validator.ValidateToken(ctx, token)
	if err != nil {
		logger.Warn("jwt validation failed",
			zap.String("request_id", requestID),
			zap.Error(err),
		)
		return false
	}

	// Cache successful validation
	tokenCache.SetJWT(token, &cache.CachedTokenInfo{
		UserID:    claims.UserID,
		ExpiresAt: claims.ExpiresAt.Time,
	})

	logger.Debug("jwt token validated and cached",
		zap.String("request_id", requestID),
		zap.String("user_id", claims.UserID),
	)

	c.Set(AuthUserIDKey, claims.UserID)
	return true
}

// validateShareToken validates a share token and caches the result
func validateShareToken(c *gin.Context, token, sessionID string, tokenCache *cache.TokenCache, repo repository.AuditRepository, logger *zap.Logger) bool {
	requestID := GetRequestID(c)

	// Check cache first
	if _, found := tokenCache.GetShareToken(token, sessionID); found {
		logger.Debug("share token found in cache",
			zap.String("request_id", requestID),
			zap.String("session_id", sessionID),
		)
		return true
	}

	// Validate with repository
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	valid, err := repo.ValidateShareToken(ctx, token, sessionID)
	if err != nil {
		logger.Error("share token validation error",
			zap.String("request_id", requestID),
			zap.String("session_id", sessionID),
			zap.Error(err),
		)
		return false
	}

	if !valid {
		logger.Warn("invalid share token",
			zap.String("request_id", requestID),
			zap.String("session_id", sessionID),
		)
		return false
	}

	// Cache successful validation
	tokenCache.SetShareToken(token, sessionID, &cache.CachedTokenInfo{
		SessionID: sessionID,
		ExpiresAt: time.Now().Add(24 * time.Hour), // Default expiry
	})

	logger.Debug("share token validated and cached",
		zap.String("request_id", requestID),
		zap.String("session_id", sessionID),
	)

	return true
}

// GetAuthUserID retrieves the authenticated user ID from context
func GetAuthUserID(c *gin.Context) string {
	if userID, exists := c.Get(AuthUserIDKey); exists {
		if id, ok := userID.(string); ok {
			return id
		}
	}
	return ""
}

// GetAuthTokenType retrieves the token type from context
func GetAuthTokenType(c *gin.Context) string {
	if tokenType, exists := c.Get(AuthTokenTypeKey); exists {
		if t, ok := tokenType.(string); ok {
			return t
		}
	}
	return ""
}
