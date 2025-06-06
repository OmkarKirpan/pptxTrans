package jwt

import (
	"context"
	"crypto/rsa"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Claims represents the JWT claims we care about
type Claims struct {
	jwt.RegisteredClaims
	UserID string // UserID is populated from Subject claim
}

// TokenValidator defines the interface for JWT token validation
type TokenValidator interface {
	ValidateToken(ctx context.Context, tokenString string) (*Claims, error)
	ExtractUserID(ctx context.Context, tokenString string) (string, error)
}

// tokenValidator implements the TokenValidator interface
type tokenValidator struct {
	verifyKey *rsa.PublicKey
}

// NewTokenValidator creates a new JWT token validator
func NewTokenValidator(jwtSecret string) (TokenValidator, error) {
	// Parse the RSA public key from the JWT secret
	verifyKey, err := jwt.ParseRSAPublicKeyFromPEM([]byte(jwtSecret))
	if err != nil {
		// If RSA parsing fails, try as HMAC secret for backward compatibility
		// In production, Supabase uses RS256
		return &tokenValidator{
			verifyKey: nil,
		}, nil
	}

	return &tokenValidator{
		verifyKey: verifyKey,
	}, nil
}

// ValidateToken validates a JWT token and returns the claims
func (v *tokenValidator) ValidateToken(ctx context.Context, tokenString string) (*Claims, error) {
	// Parse the token
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		// Verify the signing algorithm
		switch token.Method.(type) {
		case *jwt.SigningMethodRSA:
			if v.verifyKey == nil {
				return nil, errors.New("no RSA key configured")
			}
			return v.verifyKey, nil
		case *jwt.SigningMethodHMAC:
			// Fallback for local development/testing
			if v.verifyKey != nil {
				return nil, errors.New("token signed with HMAC but RSA key configured")
			}
			// Return the raw secret for HMAC
			return []byte(jwtSecret), nil
		default:
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	// Check if token is valid
	if !token.Valid {
		return nil, errors.New("invalid token")
	}

	// Extract claims
	claims, ok := token.Claims.(*Claims)
	if !ok {
		return nil, errors.New("invalid token claims")
	}

	// Validate expiration
	if claims.ExpiresAt != nil && claims.ExpiresAt.Time.Before(time.Now()) {
		return nil, errors.New("token expired")
	}

	// Validate issued at
	if claims.IssuedAt != nil && claims.IssuedAt.Time.After(time.Now()) {
		return nil, errors.New("token used before issued")
	}

	// Extract user ID from sub claim
	if claims.Subject != "" {
		claims.UserID = claims.Subject
	}

	return claims, nil
}

// ExtractUserID is a convenience method to get just the user ID
func (v *tokenValidator) ExtractUserID(ctx context.Context, tokenString string) (string, error) {
	claims, err := v.ValidateToken(ctx, tokenString)
	if err != nil {
		return "", err
	}

	if claims.UserID == "" {
		return "", errors.New("no user ID in token")
	}

	return claims.UserID, nil
}

// For HMAC fallback, we need to store the secret
var jwtSecret string

// SetHMACSecret sets the HMAC secret for fallback authentication
func SetHMACSecret(secret string) {
	jwtSecret = secret
}
