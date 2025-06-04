package middleware

import (
	"net/http"

	"audit-service/internal/domain"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// ErrorHandler middleware handles errors and ensures consistent error responses
func ErrorHandler(logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		requestID := GetRequestID(c)

		// Check if there are any errors
		if len(c.Errors) > 0 {
			err := c.Errors.Last()

			// Log the error
			logger.Error("request error",
				zap.String("request_id", requestID),
				zap.Error(err.Err),
				zap.Uint64("type", uint64(err.Type)),
			)

			// Check if it's already an API error
			if apiErr, ok := err.Err.(*domain.APIError); ok {
				c.JSON(apiErr.Status, apiErr)
				return
			}

			// Convert to API error
			apiErr := domain.ToAPIError(err.Err)
			c.JSON(apiErr.Status, apiErr)
		} else {
			// Log server errors even when no errors in c.Errors
			status := c.Writer.Status()
			if status >= 500 {
				logger.Error("server error response",
					zap.String("request_id", requestID),
					zap.Int("status", status),
					zap.String("path", c.Request.URL.Path),
					zap.String("method", c.Request.Method),
				)
			}
		}
	}
}

// HandleNotFound returns a handler for 404 errors
func HandleNotFound() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusNotFound, domain.NewAPIError("not_found", "The requested resource was not found", http.StatusNotFound))
	}
}

// HandleMethodNotAllowed returns a handler for 405 errors
func HandleMethodNotAllowed() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusMethodNotAllowed, domain.NewAPIError("method_not_allowed", "HTTP method not allowed for this resource", http.StatusMethodNotAllowed))
	}
}
