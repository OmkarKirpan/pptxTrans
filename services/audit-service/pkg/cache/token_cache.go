package cache

import (
	"crypto/sha256"
	"fmt"
	"time"

	"github.com/patrickmn/go-cache"
)

// TokenCache provides caching for validated tokens
type TokenCache struct {
	cache *cache.Cache
	jwtTTL time.Duration
	shareTokenTTL time.Duration
}

// NewTokenCache creates a new token cache instance
func NewTokenCache(jwtTTL, shareTokenTTL, cleanupInterval time.Duration) *TokenCache {
	return &TokenCache{
		cache:         cache.New(cache.NoExpiration, cleanupInterval),
		jwtTTL:        jwtTTL,
		shareTokenTTL: shareTokenTTL,
	}
}

// CachedTokenInfo stores the validated token information
type CachedTokenInfo struct {
	UserID    string
	SessionID string
	ExpiresAt time.Time
}

// GetJWT retrieves a cached JWT validation result
func (tc *TokenCache) GetJWT(token string) (*CachedTokenInfo, bool) {
	key := tc.getJWTKey(token)
	if val, found := tc.cache.Get(key); found {
		if info, ok := val.(*CachedTokenInfo); ok {
			// Check if the cached info has expired
			if time.Now().Before(info.ExpiresAt) {
				return info, true
			}
			// Remove expired entry
			tc.cache.Delete(key)
		}
	}
	return nil, false
}

// SetJWT caches a JWT validation result
func (tc *TokenCache) SetJWT(token string, info *CachedTokenInfo) {
	key := tc.getJWTKey(token)
	tc.cache.Set(key, info, tc.jwtTTL)
}

// GetShareToken retrieves a cached share token validation result
func (tc *TokenCache) GetShareToken(token, sessionID string) (*CachedTokenInfo, bool) {
	key := tc.getShareTokenKey(token, sessionID)
	if val, found := tc.cache.Get(key); found {
		if info, ok := val.(*CachedTokenInfo); ok {
			return info, true
		}
	}
	return nil, false
}

// SetShareToken caches a share token validation result
func (tc *TokenCache) SetShareToken(token, sessionID string, info *CachedTokenInfo) {
	key := tc.getShareTokenKey(token, sessionID)
	tc.cache.Set(key, info, tc.shareTokenTTL)
}

// InvalidateJWT removes a JWT from the cache
func (tc *TokenCache) InvalidateJWT(token string) {
	key := tc.getJWTKey(token)
	tc.cache.Delete(key)
}

// InvalidateShareToken removes a share token from the cache
func (tc *TokenCache) InvalidateShareToken(token, sessionID string) {
	key := tc.getShareTokenKey(token, sessionID)
	tc.cache.Delete(key)
}

// getJWTKey generates a cache key for JWT tokens
func (tc *TokenCache) getJWTKey(token string) string {
	// Hash the token to avoid storing sensitive data
	hash := sha256.Sum256([]byte(token))
	return fmt.Sprintf("jwt:%x", hash)
}

// getShareTokenKey generates a cache key for share tokens
func (tc *TokenCache) getShareTokenKey(token, sessionID string) string {
	return fmt.Sprintf("share:%s:%s", token, sessionID)
}

// Stats returns cache statistics
func (tc *TokenCache) Stats() map[string]interface{} {
	items := tc.cache.ItemCount()
	return map[string]interface{}{
		"items":     items,
		"jwt_ttl":   tc.jwtTTL.String(),
		"share_ttl": tc.shareTokenTTL.String(),
	}
}

// Clear removes all items from the cache
func (tc *TokenCache) Clear() {
	tc.cache.Flush()
} 