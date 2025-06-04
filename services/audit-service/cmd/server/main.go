package main

// @title Audit Service API
// @version 1.0.0
// @description A read-only microservice for accessing PowerPoint translation session audit logs
// @termsOfService http://swagger.io/terms/

// @contact.name API Support
// @contact.url http://www.swagger.io/support
// @contact.email support@swagger.io

// @license.name MIT
// @license.url https://opensource.org/licenses/MIT

// @host localhost:4006
// @BasePath /api/v1

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Type "Bearer" followed by a space and JWT token.

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	_ "audit-service/docs" // Import generated docs
	"audit-service/internal/config"
	"audit-service/internal/handlers"
	"audit-service/internal/middleware"
	"audit-service/internal/repository"
	"audit-service/internal/service"
	"audit-service/pkg/cache"
	"audit-service/pkg/jwt"
	"audit-service/pkg/logger"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	"go.uber.org/zap"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize logger
	zapLogger, err := logger.New(cfg.LogLevel)
	if err != nil {
		log.Fatalf("Failed to initialize logger: %v", err)
	}
	defer zapLogger.Sync()

	zapLogger.Info("starting audit service",
		zap.String("port", cfg.Port),
		zap.String("log_level", cfg.LogLevel),
	)

	// Set Gin mode based on log level
	if cfg.LogLevel == "debug" {
		gin.SetMode(gin.DebugMode)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}

	// Initialize dependencies
	tokenValidator, err := jwt.NewTokenValidator(cfg.SupabaseJWTSecret)
	if err != nil {
		zapLogger.Fatal("failed to initialize token validator", zap.Error(err))
	}

	// Set HMAC secret for fallback
	jwt.SetHMACSecret(cfg.SupabaseJWTSecret)

	tokenCache := cache.NewTokenCache(
		cfg.CacheJWTTTL,
		cfg.CacheShareTokenTTL,
		cfg.CacheCleanupInterval,
	)

	supabaseClient := repository.NewSupabaseClient(cfg, zapLogger)
	auditRepo := repository.NewAuditRepository(supabaseClient, zapLogger)
	auditService := service.NewAuditService(auditRepo, tokenCache, zapLogger)
	auditHandler := handlers.NewAuditHandler(auditService, zapLogger)

	// Setup router
	router := setupRouter(cfg, tokenValidator, tokenCache, auditRepo, auditHandler, zapLogger)

	// Create server
	srv := &http.Server{
		Addr:    fmt.Sprintf(":%s", cfg.Port),
		Handler: router,
	}

	// Start server in goroutine
	go func() {
		zapLogger.Info("server starting", zap.String("addr", srv.Addr))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			zapLogger.Fatal("failed to start server", zap.Error(err))
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	zapLogger.Info("shutting down server...")

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		zapLogger.Fatal("server forced to shutdown", zap.Error(err))
	}

	zapLogger.Info("server exited")
}

func setupRouter(
	cfg *config.Config,
	tokenValidator jwt.TokenValidator,
	tokenCache *cache.TokenCache,
	auditRepo repository.AuditRepository,
	auditHandler *handlers.AuditHandler,
	zapLogger *zap.Logger,
) *gin.Engine {
	router := gin.New()

	// Apply CORS middleware first to ensure headers are set for all responses
	router.Use(middleware.CORSMiddleware(cfg.CORSOrigin, zapLogger))

	// Other global middleware
	router.Use(
		gin.Recovery(),
		middleware.RequestID(),
		middleware.Logger(zapLogger),
		middleware.ErrorHandler(zapLogger),
	)

	// Health check endpoint
	router.GET("/health", handleHealth)

	// Custom wrapper for Swagger UI that handles redirects
	router.GET("/docs/*any", func(c *gin.Context) {
		// Check if the path is exactly /docs/ or /docs
		path := c.Param("any")
		if path == "" || path == "/" {
			c.Redirect(http.StatusMovedPermanently, "/docs/index.html")
			return
		}
		// Otherwise use the standard handler
		ginSwagger.WrapHandler(swaggerFiles.Handler)(c)
	})

	// Create the events handler
	auditService := service.NewAuditService(auditRepo, tokenCache, zapLogger)
	eventsHandler := handlers.NewEventsHandler(auditService, zapLogger)

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		// Events endpoint - create new audit events
		v1.POST("/events", eventsHandler.CreateEvent)

		// Protected routes
		sessions := v1.Group("/sessions")
		sessions.Use(middleware.Auth(tokenValidator, tokenCache, auditRepo, zapLogger))
		{
			sessions.GET("/:sessionId/history", auditHandler.GetHistory)
		}
	}

	// 404 handler
	router.NoRoute(middleware.HandleNotFound())
	router.NoMethod(middleware.HandleMethodNotAllowed())

	return router
}

func handleHealth(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "healthy",
		"service": "audit-service",
		"version": "1.0.0",
		"time":    time.Now().UTC().Format(time.RFC3339),
	})
}
