package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// CORSMiddleware adds CORS headers to allow cross-origin requests
func CORSMiddleware(corsOrigin string, logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Use the provided CORS origin or default to localhost:3000
		allowedOrigin := corsOrigin
		if allowedOrigin == "" {
			allowedOrigin = "http://localhost:3000" // Default to Next.js development server
		}

		// Log the allowed origin for debugging
		logger.Debug("CORS configuration",
			zap.String("allowed_origin", allowedOrigin),
			zap.String("request_origin", c.Request.Header.Get("Origin")),
		)

		// Get the request origin
		origin := c.Request.Header.Get("Origin")

		// In development mode, accept all origins or use the specified one
		if gin.Mode() == gin.DebugMode {
			// If there's an origin header, echo it back to be more permissive in development
			if origin != "" {
				c.Header("Access-Control-Allow-Origin", origin)
			} else {
				// Default to the configured origin if no origin header
				c.Header("Access-Control-Allow-Origin", allowedOrigin)
			}
		} else {
			// In production, only allow the configured origin
			if origin == allowedOrigin {
				c.Header("Access-Control-Allow-Origin", allowedOrigin)
			}
		}

		// Always set these headers
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-ID")
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Vary", "Origin") // Important for caching

		// Handle preflight requests
		if c.Request.Method == "OPTIONS" {
			c.Header("Access-Control-Max-Age", "86400") // 24 hours
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
