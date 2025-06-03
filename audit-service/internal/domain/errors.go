package domain

import (
	"errors"
	"fmt"
)

// Common domain errors
var (
	// Authentication errors
	ErrUnauthorized = errors.New("unauthorized")
	ErrInvalidToken = errors.New("invalid token")
	ErrTokenExpired = errors.New("token expired")
	ErrMissingToken = errors.New("missing authentication token")

	// Authorization errors
	ErrForbidden    = errors.New("forbidden")
	ErrAccessDenied = errors.New("access denied to this resource")

	// Resource errors
	ErrNotFound        = errors.New("resource not found")
	ErrSessionNotFound = errors.New("session not found")

	// Validation errors
	ErrInvalidSessionID  = errors.New("invalid session ID format")
	ErrInvalidPagination = errors.New("invalid pagination parameters")

	// Service errors
	ErrServiceUnavailable = errors.New("service temporarily unavailable")
	ErrTimeout            = errors.New("request timeout")
)

// APIError represents an error response to be returned to the client
type APIError struct {
	Code    string `json:"error"`
	Message string `json:"message"`
	Status  int    `json:"-"`
}

// Error implements the error interface
func (e *APIError) Error() string {
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// Common API errors
var (
	APIErrInvalidRequest = &APIError{
		Code:    "invalid_request",
		Message: "Invalid request parameters",
		Status:  400,
	}

	APIErrUnauthorized = &APIError{
		Code:    "unauthorized",
		Message: "Authentication required",
		Status:  401,
	}

	APIErrForbidden = &APIError{
		Code:    "forbidden",
		Message: "Access denied to this resource",
		Status:  403,
	}

	APIErrNotFound = &APIError{
		Code:    "not_found",
		Message: "The requested resource was not found",
		Status:  404,
	}

	APIErrMethodNotAllowed = &APIError{
		Code:    "method_not_allowed",
		Message: "HTTP method not allowed for this resource",
		Status:  405,
	}

	APIErrBadRequest = &APIError{
		Code:    "bad_request",
		Message: "Invalid request parameters",
		Status:  400,
	}

	APIErrInternalServer = &APIError{
		Code:    "internal_server_error",
		Message: "An internal server error occurred",
		Status:  500,
	}

	APIErrServiceUnavailable = &APIError{
		Code:    "service_unavailable",
		Message: "Service temporarily unavailable",
		Status:  503,
	}
)

// NewAPIError creates a new API error with custom message
func NewAPIError(code string, message string, status int) *APIError {
	return &APIError{
		Code:    code,
		Message: message,
		Status:  status,
	}
}

// ToAPIError converts domain errors to API errors
func ToAPIError(err error) *APIError {
	switch {
	case errors.Is(err, ErrUnauthorized),
		errors.Is(err, ErrInvalidToken),
		errors.Is(err, ErrTokenExpired),
		errors.Is(err, ErrMissingToken):
		return APIErrUnauthorized

	case errors.Is(err, ErrForbidden),
		errors.Is(err, ErrAccessDenied):
		return APIErrForbidden

	case errors.Is(err, ErrNotFound),
		errors.Is(err, ErrSessionNotFound):
		return APIErrNotFound

	case errors.Is(err, ErrInvalidSessionID),
		errors.Is(err, ErrInvalidPagination):
		return APIErrBadRequest

	case errors.Is(err, ErrServiceUnavailable):
		return APIErrServiceUnavailable

	case errors.Is(err, ErrTimeout):
		return NewAPIError("timeout", "Request timeout", 504)

	default:
		return APIErrInternalServer
	}
}
