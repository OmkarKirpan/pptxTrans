package domain

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAPIError_Error(t *testing.T) {
	apiErr := &APIError{
		Code:    "test_error",
		Message: "Test error message",
		Status:  400,
	}

	expected := "test_error: Test error message"
	assert.Equal(t, expected, apiErr.Error())
}

func TestNewAPIError(t *testing.T) {
	code := "custom_error"
	message := "Custom error message"
	status := 422

	apiErr := NewAPIError(code, message, status)

	assert.Equal(t, code, apiErr.Code)
	assert.Equal(t, message, apiErr.Message)
	assert.Equal(t, status, apiErr.Status)
}

func TestToAPIError(t *testing.T) {
	tests := []struct {
		name        string
		inputError  error
		expectedErr *APIError
	}{
		{
			name:        "unauthorized error",
			inputError:  ErrUnauthorized,
			expectedErr: APIErrUnauthorized,
		},
		{
			name:        "invalid token error",
			inputError:  ErrInvalidToken,
			expectedErr: APIErrUnauthorized,
		},
		{
			name:        "token expired error",
			inputError:  ErrTokenExpired,
			expectedErr: APIErrUnauthorized,
		},
		{
			name:        "missing token error",
			inputError:  ErrMissingToken,
			expectedErr: APIErrUnauthorized,
		},
		{
			name:        "forbidden error",
			inputError:  ErrForbidden,
			expectedErr: APIErrForbidden,
		},
		{
			name:        "access denied error",
			inputError:  ErrAccessDenied,
			expectedErr: APIErrForbidden,
		},
		{
			name:        "not found error",
			inputError:  ErrNotFound,
			expectedErr: APIErrNotFound,
		},
		{
			name:        "session not found error",
			inputError:  ErrSessionNotFound,
			expectedErr: APIErrNotFound,
		},
		{
			name:        "invalid session ID error",
			inputError:  ErrInvalidSessionID,
			expectedErr: APIErrBadRequest,
		},
		{
			name:        "invalid pagination error",
			inputError:  ErrInvalidPagination,
			expectedErr: APIErrBadRequest,
		},
		{
			name:        "service unavailable error",
			inputError:  ErrServiceUnavailable,
			expectedErr: APIErrServiceUnavailable,
		},
		{
			name:       "timeout error",
			inputError: ErrTimeout,
			expectedErr: &APIError{
				Code:    "timeout",
				Message: "Request timeout",
				Status:  504,
			},
		},
		{
			name:        "unknown error",
			inputError:  assert.AnError,
			expectedErr: APIErrInternalServer,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ToAPIError(tt.inputError)
			assert.Equal(t, tt.expectedErr.Code, result.Code)
			assert.Equal(t, tt.expectedErr.Message, result.Message)
			assert.Equal(t, tt.expectedErr.Status, result.Status)
		})
	}
}

func TestCommonAPIErrors(t *testing.T) {
	// Test that all common API errors are properly defined
	errors := []*APIError{
		APIErrUnauthorized,
		APIErrForbidden,
		APIErrNotFound,
		APIErrBadRequest,
		APIErrInternalServer,
		APIErrServiceUnavailable,
	}

	for _, apiErr := range errors {
		assert.NotEmpty(t, apiErr.Code)
		assert.NotEmpty(t, apiErr.Message)
		assert.Greater(t, apiErr.Status, 0)
		assert.Less(t, apiErr.Status, 600) // Valid HTTP status range
	}
}

func TestDomainErrors(t *testing.T) {
	// Test that all domain errors are properly defined
	domainErrors := []error{
		ErrUnauthorized,
		ErrInvalidToken,
		ErrTokenExpired,
		ErrMissingToken,
		ErrForbidden,
		ErrAccessDenied,
		ErrNotFound,
		ErrSessionNotFound,
		ErrInvalidSessionID,
		ErrInvalidPagination,
		ErrServiceUnavailable,
		ErrTimeout,
	}

	for _, err := range domainErrors {
		assert.NotNil(t, err)
		assert.NotEmpty(t, err.Error())
	}
}
