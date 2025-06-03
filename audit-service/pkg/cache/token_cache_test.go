package cache

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestNewTokenCache(t *testing.T) {
	jwtTTL := 5 * time.Minute
	shareTokenTTL := 1 * time.Minute
	cleanupInterval := 10 * time.Minute

	cache := NewTokenCache(jwtTTL, shareTokenTTL, cleanupInterval)

	assert.NotNil(t, cache)
	assert.Equal(t, jwtTTL, cache.jwtTTL)
	assert.Equal(t, shareTokenTTL, cache.shareTokenTTL)
	assert.NotNil(t, cache.cache)
}

func TestTokenCache_JWT_Operations(t *testing.T) {
	cache := NewTokenCache(5*time.Minute, 1*time.Minute, 10*time.Minute)
	token := "test-jwt-token"

	// Test cache miss
	info, found := cache.GetJWT(token)
	assert.False(t, found)
	assert.Nil(t, info)

	// Test cache set and get
	expectedInfo := &CachedTokenInfo{
		UserID:    "user-123",
		ExpiresAt: time.Now().Add(1 * time.Hour),
	}
	cache.SetJWT(token, expectedInfo)

	info, found = cache.GetJWT(token)
	assert.True(t, found)
	assert.NotNil(t, info)
	assert.Equal(t, expectedInfo.UserID, info.UserID)

	// Test invalidation
	cache.InvalidateJWT(token)
	info, found = cache.GetJWT(token)
	assert.False(t, found)
	assert.Nil(t, info)
}

func TestTokenCache_ShareToken_Operations(t *testing.T) {
	cache := NewTokenCache(5*time.Minute, 1*time.Minute, 10*time.Minute)
	token := "test-share-token"
	sessionID := "session-123"

	// Test cache miss
	info, found := cache.GetShareToken(token, sessionID)
	assert.False(t, found)
	assert.Nil(t, info)

	// Test cache set and get
	expectedInfo := &CachedTokenInfo{
		SessionID: sessionID,
		ExpiresAt: time.Now().Add(24 * time.Hour),
	}
	cache.SetShareToken(token, sessionID, expectedInfo)

	info, found = cache.GetShareToken(token, sessionID)
	assert.True(t, found)
	assert.NotNil(t, info)
	assert.Equal(t, expectedInfo.SessionID, info.SessionID)

	// Test invalidation
	cache.InvalidateShareToken(token, sessionID)
	info, found = cache.GetShareToken(token, sessionID)
	assert.False(t, found)
	assert.Nil(t, info)
}

func TestTokenCache_JWT_Expiration(t *testing.T) {
	cache := NewTokenCache(5*time.Minute, 1*time.Minute, 10*time.Minute)
	token := "expired-jwt-token"

	// Set token with past expiration
	expiredInfo := &CachedTokenInfo{
		UserID:    "user-123",
		ExpiresAt: time.Now().Add(-1 * time.Hour), // Expired 1 hour ago
	}
	cache.SetJWT(token, expiredInfo)

	// Should not return expired token
	info, found := cache.GetJWT(token)
	assert.False(t, found)
	assert.Nil(t, info)
}

func TestTokenCache_JWTKeyGeneration(t *testing.T) {
	cache := NewTokenCache(5*time.Minute, 1*time.Minute, 10*time.Minute)

	// Test that same token generates same key
	token := "test-token"
	key1 := cache.getJWTKey(token)
	key2 := cache.getJWTKey(token)
	assert.Equal(t, key1, key2)
	assert.Contains(t, key1, "jwt:")

	// Test that different tokens generate different keys
	token2 := "different-token"
	key3 := cache.getJWTKey(token2)
	assert.NotEqual(t, key1, key3)
}

func TestTokenCache_ShareTokenKeyGeneration(t *testing.T) {
	cache := NewTokenCache(5*time.Minute, 1*time.Minute, 10*time.Minute)

	token := "share-token"
	sessionID := "session-123"

	// Test key generation
	key1 := cache.getShareTokenKey(token, sessionID)
	key2 := cache.getShareTokenKey(token, sessionID)
	assert.Equal(t, key1, key2)
	assert.Contains(t, key1, "share:")
	assert.Contains(t, key1, token)
	assert.Contains(t, key1, sessionID)

	// Test different session generates different key
	key3 := cache.getShareTokenKey(token, "different-session")
	assert.NotEqual(t, key1, key3)
}

func TestTokenCache_Stats(t *testing.T) {
	cache := NewTokenCache(5*time.Minute, 1*time.Minute, 10*time.Minute)

	// Initial stats
	stats := cache.Stats()
	assert.Contains(t, stats, "items")
	assert.Contains(t, stats, "jwt_ttl")
	assert.Contains(t, stats, "share_ttl")
	assert.Equal(t, 0, stats["items"])

	// Add some items
	cache.SetJWT("jwt-token", &CachedTokenInfo{UserID: "user1"})
	cache.SetShareToken("share-token", "session1", &CachedTokenInfo{SessionID: "session1"})

	stats = cache.Stats()
	assert.Equal(t, 2, stats["items"])
	assert.Equal(t, "5m0s", stats["jwt_ttl"])
	assert.Equal(t, "1m0s", stats["share_ttl"])
}

func TestTokenCache_Clear(t *testing.T) {
	cache := NewTokenCache(5*time.Minute, 1*time.Minute, 10*time.Minute)

	// Add some items
	cache.SetJWT("jwt-token", &CachedTokenInfo{UserID: "user1"})
	cache.SetShareToken("share-token", "session1", &CachedTokenInfo{SessionID: "session1"})

	// Verify items are there
	stats := cache.Stats()
	assert.Equal(t, 2, stats["items"])

	// Clear cache
	cache.Clear()

	// Verify cache is empty
	stats = cache.Stats()
	assert.Equal(t, 0, stats["items"])

	// Verify items are gone
	_, found := cache.GetJWT("jwt-token")
	assert.False(t, found)

	_, found = cache.GetShareToken("share-token", "session1")
	assert.False(t, found)
}
