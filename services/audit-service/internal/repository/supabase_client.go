package repository

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"audit-service/internal/config"

	"go.uber.org/zap"
)

// SupabaseClientInterface defines the interface for Supabase client operations
type SupabaseClientInterface interface {
	Get(ctx context.Context, endpoint string, queryParams map[string]string) ([]byte, int, error)
	Post(ctx context.Context, endpoint string, payload interface{}) ([]byte, error)
}

// SupabaseClient handles communication with Supabase REST API
type SupabaseClient struct {
	baseURL    string
	httpClient *http.Client
	headers    map[string]string
	logger     *zap.Logger
}

// NewSupabaseClient creates a new Supabase REST API client
func NewSupabaseClient(cfg *config.Config, logger *zap.Logger) *SupabaseClient {
	// Configure HTTP client with connection pooling
	httpClient := &http.Client{
		Timeout: cfg.HTTPTimeout,
		Transport: &http.Transport{
			MaxIdleConns:        cfg.HTTPMaxIdleConns,
			MaxIdleConnsPerHost: cfg.HTTPMaxConnsPerHost,
			IdleConnTimeout:     cfg.HTTPIdleConnTimeout,
		},
	}

	return &SupabaseClient{
		baseURL:    fmt.Sprintf("%s/rest/v1", cfg.SupabaseURL),
		httpClient: httpClient,
		headers:    cfg.GetSupabaseHeaders(),
		logger:     logger,
	}
}

// SupabaseResponse represents a generic Supabase API response
type SupabaseResponse struct {
	Data  json.RawMessage `json:"data"`
	Error *SupabaseError  `json:"error,omitempty"`
	Count int             `json:"count,omitempty"`
}

// SupabaseError represents an error from Supabase
type SupabaseError struct {
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
	Hint    string `json:"hint,omitempty"`
	Code    string `json:"code,omitempty"`
}

// Error implements the error interface
func (e *SupabaseError) Error() string {
	return e.Message
}

// Get performs a GET request to Supabase
func (c *SupabaseClient) Get(ctx context.Context, endpoint string, queryParams map[string]string) ([]byte, int, error) {
	// Build URL with query parameters
	fullURL, err := c.buildURL(endpoint, queryParams)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to build URL: %w", err)
	}

	// Create request
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fullURL, nil)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to create request: %w", err)
	}

	// Add headers
	for key, value := range c.headers {
		req.Header.Set(key, value)
	}

	// Log request
	c.logger.Debug("making supabase request",
		zap.String("method", "GET"),
		zap.String("url", fullURL),
	)

	// Execute request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to read response: %w", err)
	}

	// Log response
	c.logger.Debug("supabase response",
		zap.Int("status", resp.StatusCode),
		zap.Int("body_size", len(body)),
	)

	// Check for errors
	if resp.StatusCode >= 400 {
		var supErr SupabaseError
		if err := json.Unmarshal(body, &supErr); err == nil && supErr.Message != "" {
			return nil, resp.StatusCode, &supErr
		}
		return nil, resp.StatusCode, fmt.Errorf("request failed with status %d: %s", resp.StatusCode, string(body))
	}

	// Extract count from headers if available
	count := 0
	if contentRange := resp.Header.Get("Content-Range"); contentRange != "" {
		// Parse count from Content-Range header (e.g., "0-9/100")
		var rangeStart, rangeEnd int
		fmt.Sscanf(contentRange, "%d-%d/%d", &rangeStart, &rangeEnd, &count)
	}

	return body, count, nil
}

// Post performs a POST request to Supabase
func (c *SupabaseClient) Post(ctx context.Context, endpoint string, payload interface{}) ([]byte, error) {
	// Marshal payload
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	// Build URL
	fullURL := fmt.Sprintf("%s%s", c.baseURL, endpoint)

	// Create request
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fullURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Add headers
	for key, value := range c.headers {
		req.Header.Set(key, value)
	}

	// Execute request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Check for errors
	if resp.StatusCode >= 400 {
		var supErr SupabaseError
		if err := json.Unmarshal(body, &supErr); err == nil && supErr.Message != "" {
			return nil, &supErr
		}
		return nil, fmt.Errorf("request failed with status %d: %s", resp.StatusCode, string(body))
	}

	return body, nil
}

// buildURL constructs the full URL with query parameters
func (c *SupabaseClient) buildURL(endpoint string, queryParams map[string]string) (string, error) {
	baseURL := fmt.Sprintf("%s%s", c.baseURL, endpoint)

	if len(queryParams) == 0 {
		return baseURL, nil
	}

	u, err := url.Parse(baseURL)
	if err != nil {
		return "", err
	}

	q := u.Query()
	for key, value := range queryParams {
		q.Set(key, value)
	}
	u.RawQuery = q.Encode()

	return u.String(), nil
}
