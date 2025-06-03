package jwt

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
)

// Test constants
const (
	testUserID = "test-user-456"
)

// Test HMAC secret
const testHMACSecret = "test-hmac-secret-for-testing-purposes"

// Helper function to generate test RSA keys
func generateTestRSAKeys() (*rsa.PrivateKey, *rsa.PublicKey, error) {
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, nil, err
	}
	return privateKey, &privateKey.PublicKey, nil
}

// Helper function to create valid RSA JWT token
func createTestRSAToken(claims *Claims, privateKey *rsa.PrivateKey) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	return token.SignedString(privateKey)
}

// Helper function to create valid HMAC JWT token
func createTestHMACToken(claims *Claims, secret string) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// Helper function to get public key PEM
func getPublicKeyPEM(publicKey *rsa.PublicKey) (string, error) {
	pubASN1, err := x509.MarshalPKIXPublicKey(publicKey)
	if err != nil {
		return "", err
	}

	pubPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "PUBLIC KEY",
		Bytes: pubASN1,
	})

	return string(pubPEM), nil
}

func TestNewTokenValidator(t *testing.T) {
	// Generate a valid RSA key for testing
	_, publicKey, err := generateTestRSAKeys()
	assert.NoError(t, err)

	publicKeyPEM, err := getPublicKeyPEM(publicKey)
	assert.NoError(t, err)

	tests := []struct {
		name        string
		jwtSecret   string
		expectError bool
	}{
		{
			name:        "valid_rsa_public_key",
			jwtSecret:   publicKeyPEM,
			expectError: false,
		},
		{
			name:        "invalid_rsa_key",
			jwtSecret:   "invalid-key-data",
			expectError: false, // Should fallback to HMAC
		},
		{
			name:        "hmac_secret",
			jwtSecret:   testHMACSecret,
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			validator, err := NewTokenValidator(tt.jwtSecret)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, validator)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, validator)
				assert.Implements(t, (*TokenValidator)(nil), validator)
			}
		})
	}
}

func TestTokenValidator_ValidateToken(t *testing.T) {
	// Generate test keys
	privateKey, publicKey, err := generateTestRSAKeys()
	assert.NoError(t, err)

	publicKeyPEM, err := getPublicKeyPEM(publicKey)
	assert.NoError(t, err)

	// Create validators
	rsaValidator, err := NewTokenValidator(publicKeyPEM)
	assert.NoError(t, err)

	SetHMACSecret(testHMACSecret)
	hmacValidator, err := NewTokenValidator("invalid-rsa-key")
	assert.NoError(t, err)

	tests := []struct {
		name           string
		validator      TokenValidator
		setupToken     func() string
		expectedClaims *Claims
		expectedError  string
	}{
		{
			name:      "valid_rsa_token",
			validator: rsaValidator,
			setupToken: func() string {
				claims := &Claims{
					RegisteredClaims: jwt.RegisteredClaims{
						Subject:   testUserID,
						ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
						IssuedAt:  jwt.NewNumericDate(time.Now().Add(-5 * time.Minute)),
						Issuer:    "test-issuer",
					},
				}
				token, _ := createTestRSAToken(claims, privateKey)
				return token
			},
			expectedClaims: &Claims{
				RegisteredClaims: jwt.RegisteredClaims{
					Subject: testUserID,
					Issuer:  "test-issuer",
				},
				UserID: testUserID,
			},
			expectedError: "",
		},
		{
			name:      "valid_hmac_token",
			validator: hmacValidator,
			setupToken: func() string {
				claims := &Claims{
					RegisteredClaims: jwt.RegisteredClaims{
						Subject:   testUserID,
						ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
						IssuedAt:  jwt.NewNumericDate(time.Now().Add(-5 * time.Minute)),
						Issuer:    "test-issuer",
					},
				}
				token, _ := createTestHMACToken(claims, testHMACSecret)
				return token
			},
			expectedClaims: &Claims{
				RegisteredClaims: jwt.RegisteredClaims{
					Subject: testUserID,
					Issuer:  "test-issuer",
				},
				UserID: testUserID,
			},
			expectedError: "",
		},
		{
			name:      "expired_token",
			validator: rsaValidator,
			setupToken: func() string {
				claims := &Claims{
					RegisteredClaims: jwt.RegisteredClaims{
						Subject:   testUserID,
						ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)),
						IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)),
						Issuer:    "test-issuer",
					},
				}
				token, _ := createTestRSAToken(claims, privateKey)
				return token
			},
			expectedClaims: nil,
			expectedError:  "token has invalid claims: token is expired",
		},
		{
			name:      "token_used_before_issued",
			validator: rsaValidator,
			setupToken: func() string {
				claims := &Claims{
					RegisteredClaims: jwt.RegisteredClaims{
						Subject:   testUserID,
						ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
						IssuedAt:  jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
						Issuer:    "test-issuer",
					},
				}
				token, _ := createTestRSAToken(claims, privateKey)
				return token
			},
			expectedClaims: nil,
			expectedError:  "token used before issued",
		},
		{
			name:      "invalid_token_format",
			validator: rsaValidator,
			setupToken: func() string {
				return "invalid.token.format"
			},
			expectedClaims: nil,
			expectedError:  "failed to parse token",
		},
		{
			name:      "token_signed_with_wrong_key",
			validator: rsaValidator,
			setupToken: func() string {
				wrongPrivateKey, _, _ := generateTestRSAKeys()
				claims := &Claims{
					RegisteredClaims: jwt.RegisteredClaims{
						Subject:   testUserID,
						ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
						IssuedAt:  jwt.NewNumericDate(time.Now().Add(-5 * time.Minute)),
						Issuer:    "test-issuer",
					},
				}
				token, _ := createTestRSAToken(claims, wrongPrivateKey)
				return token
			},
			expectedClaims: nil,
			expectedError:  "failed to parse token",
		},
		{
			name:      "empty_token",
			validator: rsaValidator,
			setupToken: func() string {
				return ""
			},
			expectedClaims: nil,
			expectedError:  "failed to parse token",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			tokenString := tt.setupToken()

			// Execute
			claims, err := tt.validator.ValidateToken(context.Background(), tokenString)

			// Assert
			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
				assert.Nil(t, claims)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, claims)
				// Debug output
				if claims != nil {
					t.Logf("Claims: Subject=%s, UserID=%s, Issuer=%s", claims.Subject, claims.UserID, claims.Issuer)
				}
				assert.Equal(t, tt.expectedClaims.Subject, claims.Subject)
				assert.Equal(t, tt.expectedClaims.UserID, claims.UserID)
				assert.Equal(t, tt.expectedClaims.Issuer, claims.Issuer)
			}
		})
	}
}

func TestTokenValidator_ExtractUserID(t *testing.T) {
	// Generate test keys
	privateKey, publicKey, err := generateTestRSAKeys()
	assert.NoError(t, err)

	publicKeyPEM, err := getPublicKeyPEM(publicKey)
	assert.NoError(t, err)

	validator, err := NewTokenValidator(publicKeyPEM)
	assert.NoError(t, err)

	tests := []struct {
		name           string
		setupToken     func() string
		expectedUserID string
		expectedError  string
	}{
		{
			name: "success_extract_user_id",
			setupToken: func() string {
				claims := &Claims{
					RegisteredClaims: jwt.RegisteredClaims{
						Subject:   testUserID,
						ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
						IssuedAt:  jwt.NewNumericDate(time.Now().Add(-5 * time.Minute)),
					},
				}
				token, _ := createTestRSAToken(claims, privateKey)
				return token
			},
			expectedUserID: testUserID,
			expectedError:  "",
		},
		{
			name: "error_empty_user_id",
			setupToken: func() string {
				claims := &Claims{
					RegisteredClaims: jwt.RegisteredClaims{
						Subject:   "",
						ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
						IssuedAt:  jwt.NewNumericDate(time.Now().Add(-5 * time.Minute)),
					},
				}
				token, _ := createTestRSAToken(claims, privateKey)
				return token
			},
			expectedUserID: "",
			expectedError:  "no user ID in token",
		},
		{
			name: "error_invalid_token",
			setupToken: func() string {
				return "invalid.token.format"
			},
			expectedUserID: "",
			expectedError:  "failed to parse token",
		},
		{
			name: "error_expired_token",
			setupToken: func() string {
				claims := &Claims{
					RegisteredClaims: jwt.RegisteredClaims{
						Subject:   testUserID,
						ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)),
						IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)),
					},
				}
				token, _ := createTestRSAToken(claims, privateKey)
				return token
			},
			expectedUserID: "",
			expectedError:  "token has invalid claims: token is expired",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			tokenString := tt.setupToken()

			// Execute
			userID, err := validator.ExtractUserID(context.Background(), tokenString)

			// Assert
			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
				assert.Empty(t, userID)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedUserID, userID)
			}
		})
	}
}

func TestSetHMACSecret(t *testing.T) {
	testSecret := "new-test-secret"

	SetHMACSecret(testSecret)

	// Verify the secret was set by checking it's used in validation
	assert.Equal(t, testSecret, jwtSecret)
}

func TestClaims(t *testing.T) {
	claims := &Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   testUserID,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-5 * time.Minute)),
			Issuer:    "test-issuer",
		},
	}

	// UserID is only set by ValidateToken, not when creating Claims directly
	assert.Equal(t, testUserID, claims.Subject)
	assert.Equal(t, "test-issuer", claims.Issuer)
}
