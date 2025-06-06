package config

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/joho/godotenv"
	"github.com/spf13/viper"
)

// Config holds all configuration for the audit service
type Config struct {
	// Server configuration
	Port       string `mapstructure:"PORT"`
	LogLevel   string `mapstructure:"LOG_LEVEL"`
	CORSOrigin string `mapstructure:"CORS_ORIGIN"`

	// Supabase configuration
	SupabaseURL            string `mapstructure:"SUPABASE_URL"`
	SupabaseAnonKey        string `mapstructure:"SUPABASE_ANON_KEY"`
	SupabaseServiceRoleKey string `mapstructure:"SUPABASE_SERVICE_ROLE_KEY"`
	SupabaseJWTSecret      string `mapstructure:"SUPABASE_JWT_SECRET"`

	// HTTP Client configuration
	HTTPTimeout         time.Duration `mapstructure:"HTTP_TIMEOUT"`
	HTTPMaxIdleConns    int           `mapstructure:"HTTP_MAX_IDLE_CONNS"`
	HTTPMaxConnsPerHost int           `mapstructure:"HTTP_MAX_CONNS_PER_HOST"`
	HTTPIdleConnTimeout time.Duration `mapstructure:"HTTP_IDLE_CONN_TIMEOUT"`

	// Cache configuration
	CacheJWTTTL          time.Duration `mapstructure:"CACHE_JWT_TTL"`
	CacheShareTokenTTL   time.Duration `mapstructure:"CACHE_SHARE_TOKEN_TTL"`
	CacheCleanupInterval time.Duration `mapstructure:"CACHE_CLEANUP_INTERVAL"`

	// Application configuration
	MaxPageSize     int `mapstructure:"MAX_PAGE_SIZE"`
	DefaultPageSize int `mapstructure:"DEFAULT_PAGE_SIZE"`
}

// Load reads configuration from environment variables
func Load() (*Config, error) {
	// First try to load from .env file using godotenv
	// Try multiple possible locations for the .env file
	possiblePaths := []string{
		".env",                      // Current directory
		"../.env",                   // Parent directory
		"../../.env",                // Grandparent directory
		filepath.Join("..", ".env"), // Alternative format for parent
	}

	// Print current working directory for debugging
	cwd, _ := os.Getwd()
	log.Printf("Current working directory: %s", cwd)

	// Try each possible path
	loaded := false
	for _, path := range possiblePaths {
		if _, err := os.Stat(path); err == nil {
			log.Printf("Found .env file at: %s", path)
			err := godotenv.Load(path)
			if err == nil {
				loaded = true
				log.Printf("Successfully loaded environment from: %s", path)
				break
			} else {
				log.Printf("Error loading .env file from %s: %v", path, err)
			}
		}
	}

	if !loaded {
		log.Printf("Warning: Could not find or load any .env file. Using environment variables only.")
	}

	// Configure viper to read from environment
	viper.SetConfigName(".env")
	viper.SetConfigType("env")
	viper.AddConfigPath(".")
	viper.AddConfigPath("./")
	viper.AddConfigPath("../")
	viper.AddConfigPath("../../")

	// Read .env file if it exists (ignore error if file doesn't exist)
	_ = viper.ReadInConfig()

	// Set default values
	viper.SetDefault("PORT", "4006")
	viper.SetDefault("LOG_LEVEL", "info")
	viper.SetDefault("CORS_ORIGIN", "http://localhost:3000")

	// HTTP defaults
	viper.SetDefault("HTTP_TIMEOUT", "30s")
	viper.SetDefault("HTTP_MAX_IDLE_CONNS", 100)
	viper.SetDefault("HTTP_MAX_CONNS_PER_HOST", 10)
	viper.SetDefault("HTTP_IDLE_CONN_TIMEOUT", "90s")

	// Cache defaults
	viper.SetDefault("CACHE_JWT_TTL", "5m")
	viper.SetDefault("CACHE_SHARE_TOKEN_TTL", "1m")
	viper.SetDefault("CACHE_CLEANUP_INTERVAL", "10m")

	// Pagination defaults
	viper.SetDefault("MAX_PAGE_SIZE", 100)
	viper.SetDefault("DEFAULT_PAGE_SIZE", 50)

	// Read from environment (this will override .env file values)
	viper.AutomaticEnv()

	// Debug: Print all environment variables
	log.Printf("SUPABASE_URL: %s", os.Getenv("SUPABASE_URL"))
	log.Printf("SUPABASE_SERVICE_ROLE_KEY: %s", os.Getenv("SUPABASE_SERVICE_ROLE_KEY"))
	log.Printf("SUPABASE_JWT_SECRET: %s", os.Getenv("SUPABASE_JWT_SECRET"))
	log.Printf("CORS_ORIGIN: %s", os.Getenv("CORS_ORIGIN"))

	// Create config with direct environment variable access as fallback
	cfg := Config{
		Port:       getEnvOrDefault("PORT", "4006"),
		LogLevel:   getEnvOrDefault("LOG_LEVEL", "info"),
		CORSOrigin: getEnvOrDefault("CORS_ORIGIN", "http://localhost:3000"),

		SupabaseURL:            os.Getenv("SUPABASE_URL"),
		SupabaseAnonKey:        os.Getenv("SUPABASE_ANON_KEY"),
		SupabaseServiceRoleKey: os.Getenv("SUPABASE_SERVICE_ROLE_KEY"),
		SupabaseJWTSecret:      os.Getenv("SUPABASE_JWT_SECRET"),

		MaxPageSize:     getEnvOrDefaultInt("MAX_PAGE_SIZE", 100),
		DefaultPageSize: getEnvOrDefaultInt("DEFAULT_PAGE_SIZE", 50),
	}

	// Parse duration fields
	var err error
	if cfg.HTTPTimeout, err = time.ParseDuration(getEnvOrDefault("HTTP_TIMEOUT", "30s")); err != nil {
		return nil, fmt.Errorf("invalid HTTP_TIMEOUT: %w", err)
	}
	if cfg.HTTPIdleConnTimeout, err = time.ParseDuration(getEnvOrDefault("HTTP_IDLE_CONN_TIMEOUT", "90s")); err != nil {
		return nil, fmt.Errorf("invalid HTTP_IDLE_CONN_TIMEOUT: %w", err)
	}
	if cfg.CacheJWTTTL, err = time.ParseDuration(getEnvOrDefault("CACHE_JWT_TTL", "5m")); err != nil {
		return nil, fmt.Errorf("invalid CACHE_JWT_TTL: %w", err)
	}
	if cfg.CacheShareTokenTTL, err = time.ParseDuration(getEnvOrDefault("CACHE_SHARE_TOKEN_TTL", "1m")); err != nil {
		return nil, fmt.Errorf("invalid CACHE_SHARE_TOKEN_TTL: %w", err)
	}
	if cfg.CacheCleanupInterval, err = time.ParseDuration(getEnvOrDefault("CACHE_CLEANUP_INTERVAL", "10m")); err != nil {
		return nil, fmt.Errorf("invalid CACHE_CLEANUP_INTERVAL: %w", err)
	}

	// Parse int fields
	if cfg.HTTPMaxIdleConns = getEnvOrDefaultInt("HTTP_MAX_IDLE_CONNS", 100); cfg.HTTPMaxIdleConns <= 0 {
		return nil, fmt.Errorf("HTTP_MAX_IDLE_CONNS must be positive")
	}
	if cfg.HTTPMaxConnsPerHost = getEnvOrDefaultInt("HTTP_MAX_CONNS_PER_HOST", 10); cfg.HTTPMaxConnsPerHost <= 0 {
		return nil, fmt.Errorf("HTTP_MAX_CONNS_PER_HOST must be positive")
	}

	// Try viper unmarshal as backup (this might override some values)
	var viperCfg Config
	if err := viper.Unmarshal(&viperCfg); err == nil {
		// Use viper values if they're not empty
		if viperCfg.SupabaseURL != "" {
			cfg.SupabaseURL = viperCfg.SupabaseURL
		}
		if viperCfg.SupabaseServiceRoleKey != "" {
			cfg.SupabaseServiceRoleKey = viperCfg.SupabaseServiceRoleKey
		}
		if viperCfg.SupabaseJWTSecret != "" {
			cfg.SupabaseJWTSecret = viperCfg.SupabaseJWTSecret
		}
	}

	// Validate required fields
	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("config validation failed: %w", err)
	}

	return &cfg, nil
}

// Helper function to get environment variable with default
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// Helper function to get environment variable as int with default
func getEnvOrDefaultInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := parseIntFromString(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

// Helper function to parse int from string
func parseIntFromString(s string) (int, error) {
	var result int
	_, err := fmt.Sscanf(s, "%d", &result)
	return result, err
}

// Validate ensures all required configuration is present
func (c *Config) Validate() error {
	if c.SupabaseURL == "" {
		return fmt.Errorf("SUPABASE_URL is required")
	}
	if c.SupabaseServiceRoleKey == "" {
		return fmt.Errorf("SUPABASE_SERVICE_ROLE_KEY is required")
	}
	if c.SupabaseJWTSecret == "" {
		return fmt.Errorf("SUPABASE_JWT_SECRET is required")
	}
	if c.Port == "" {
		return fmt.Errorf("PORT is required")
	}
	if c.HTTPTimeout <= 0 {
		return fmt.Errorf("HTTP_TIMEOUT must be positive")
	}
	if c.CacheJWTTTL <= 0 {
		return fmt.Errorf("CACHE_JWT_TTL must be positive")
	}
	if c.CacheShareTokenTTL <= 0 {
		return fmt.Errorf("CACHE_SHARE_TOKEN_TTL must be positive")
	}
	return nil
}

// GetSupabaseHeaders returns the required headers for Supabase REST API calls
func (c *Config) GetSupabaseHeaders() map[string]string {
	return map[string]string{
		"apikey":        c.SupabaseServiceRoleKey,
		"Authorization": "Bearer " + c.SupabaseServiceRoleKey,
		"Content-Type":  "application/json",
		"Prefer":        "count=exact",
	}
}
