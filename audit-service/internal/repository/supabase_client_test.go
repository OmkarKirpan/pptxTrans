package repository

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"audit-service/internal/config"

	"github.com/stretchr/testify/assert"
	"go.uber.org/zap"
)

func TestSupabaseClient_Get(t *testing.T) {
	tests := []struct {
		name          string
		endpoint      string
		queryParams   map[string]string
		setupServer   func() *httptest.Server
		expectedData  []byte
		expectedCount int
		expectedError string
	}{
		{
			name:     "success_simple_get",
			endpoint: "/audit_logs",
			queryParams: map[string]string{
				"session_id": "eq.test-session",
				"limit":      "10",
			},
			setupServer: func() *httptest.Server {
				return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					// Verify request
					assert.Equal(t, "/rest/v1/audit_logs", r.URL.Path)
					assert.Equal(t, "eq.test-session", r.URL.Query().Get("session_id"))
					assert.Equal(t, "10", r.URL.Query().Get("limit"))
					assert.Equal(t, "Bearer test-key", r.Header.Get("Authorization"))
					assert.Equal(t, "test-key", r.Header.Get("apikey"))

					// Send response
					data := []map[string]interface{}{
						{"id": "1", "session_id": "test-session", "action": "edit"},
						{"id": "2", "session_id": "test-session", "action": "merge"},
					}
					jsonData, _ := json.Marshal(data)

					w.Header().Set("Content-Range", "0-1/25")
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusOK)
					w.Write(jsonData)
				}))
			},
			expectedData:  []byte(`[{"action":"edit","id":"1","session_id":"test-session"},{"action":"merge","id":"2","session_id":"test-session"}]`),
			expectedCount: 25,
			expectedError: "",
		},
		{
			name:        "success_no_params",
			endpoint:    "/sessions",
			queryParams: nil,
			setupServer: func() *httptest.Server {
				return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					assert.Equal(t, "/rest/v1/sessions", r.URL.Path)
					assert.Empty(t, r.URL.RawQuery)

					data := []map[string]interface{}{
						{"id": "session-1", "user_id": "user-1"},
					}
					jsonData, _ := json.Marshal(data)

					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusOK)
					w.Write(jsonData)
				}))
			},
			expectedData:  []byte(`[{"id":"session-1","user_id":"user-1"}]`),
			expectedCount: 0,
			expectedError: "",
		},
		{
			name:     "success_empty_result",
			endpoint: "/audit_logs",
			queryParams: map[string]string{
				"session_id": "eq.non-existent",
			},
			setupServer: func() *httptest.Server {
				return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.Header().Set("Content-Range", "*/0")
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusOK)
					w.Write([]byte("[]"))
				}))
			},
			expectedData:  []byte("[]"),
			expectedCount: 0,
			expectedError: "",
		},
		{
			name:     "error_400_bad_request",
			endpoint: "/audit_logs",
			queryParams: map[string]string{
				"invalid": "eq.bad-param",
			},
			setupServer: func() *httptest.Server {
				return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					supErr := SupabaseError{
						Message: "Invalid query parameter",
						Details: "Column 'invalid' not found",
						Code:    "PGRST116",
					}
					jsonData, _ := json.Marshal(supErr)

					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusBadRequest)
					w.Write(jsonData)
				}))
			},
			expectedData:  nil,
			expectedCount: 400,
			expectedError: "Invalid query parameter",
		},
		{
			name:        "error_401_unauthorized",
			endpoint:    "/audit_logs",
			queryParams: nil,
			setupServer: func() *httptest.Server {
				return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.WriteHeader(http.StatusUnauthorized)
					w.Write([]byte("Unauthorized"))
				}))
			},
			expectedData:  nil,
			expectedCount: 401,
			expectedError: "request failed with status 401",
		},
		{
			name:        "error_500_server_error",
			endpoint:    "/audit_logs",
			queryParams: nil,
			setupServer: func() *httptest.Server {
				return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					supErr := SupabaseError{
						Message: "Internal server error",
						Details: "Database connection failed",
						Code:    "PGRST500",
					}
					jsonData, _ := json.Marshal(supErr)

					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusInternalServerError)
					w.Write(jsonData)
				}))
			},
			expectedData:  nil,
			expectedCount: 500,
			expectedError: "Internal server error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup test server
			server := tt.setupServer()
			defer server.Close()

			// Create client with test config
			cfg := &config.Config{
				SupabaseURL:            server.URL,
				SupabaseServiceRoleKey: "test-key",
				HTTPTimeout:            10 * time.Second,
				HTTPMaxIdleConns:       10,
				HTTPMaxConnsPerHost:    5,
				HTTPIdleConnTimeout:    30 * time.Second,
			}
			logger := zap.NewNop()
			client := NewSupabaseClient(cfg, logger)

			// Execute
			data, count, err := client.Get(context.Background(), tt.endpoint, tt.queryParams)

			// Assert
			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
				assert.Nil(t, data)
				assert.Equal(t, tt.expectedCount, count)
			} else {
				assert.NoError(t, err)
				assert.JSONEq(t, string(tt.expectedData), string(data))
				assert.Equal(t, tt.expectedCount, count)
			}
		})
	}
}

func TestSupabaseClient_Post(t *testing.T) {
	tests := []struct {
		name          string
		endpoint      string
		payload       interface{}
		setupServer   func() *httptest.Server
		expectedData  []byte
		expectedError string
	}{
		{
			name:     "success_create_record",
			endpoint: "/audit_logs",
			payload: map[string]interface{}{
				"session_id": "test-session",
				"user_id":    "test-user",
				"action":     "edit",
			},
			setupServer: func() *httptest.Server {
				return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					// Verify request
					assert.Equal(t, "/rest/v1/audit_logs", r.URL.Path)
					assert.Equal(t, "POST", r.Method)
					assert.Equal(t, "Bearer test-key", r.Header.Get("Authorization"))
					assert.Equal(t, "test-key", r.Header.Get("apikey"))

					// Verify payload
					var payload map[string]interface{}
					json.NewDecoder(r.Body).Decode(&payload)
					assert.Equal(t, "test-session", payload["session_id"])
					assert.Equal(t, "test-user", payload["user_id"])
					assert.Equal(t, "edit", payload["action"])

					// Send response
					response := map[string]interface{}{
						"id":         "audit-001",
						"session_id": "test-session",
						"user_id":    "test-user",
						"action":     "edit",
					}
					jsonData, _ := json.Marshal(response)

					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusCreated)
					w.Write(jsonData)
				}))
			},
			expectedData:  []byte(`{"action":"edit","id":"audit-001","session_id":"test-session","user_id":"test-user"}`),
			expectedError: "",
		},
		{
			name:     "error_400_validation_error",
			endpoint: "/audit_logs",
			payload: map[string]interface{}{
				"invalid_field": "value",
			},
			setupServer: func() *httptest.Server {
				return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					supErr := SupabaseError{
						Message: "Validation failed",
						Details: "Required field 'session_id' is missing",
						Code:    "PGRST102",
					}
					jsonData, _ := json.Marshal(supErr)

					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusBadRequest)
					w.Write(jsonData)
				}))
			},
			expectedData:  nil,
			expectedError: "Validation failed",
		},
		{
			name:     "error_invalid_payload",
			endpoint: "/audit_logs",
			payload:  make(chan int), // Invalid payload that can't be marshaled
			setupServer: func() *httptest.Server {
				return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					// This should not be reached
					w.WriteHeader(http.StatusOK)
				}))
			},
			expectedData:  nil,
			expectedError: "failed to marshal payload",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup test server
			server := tt.setupServer()
			defer server.Close()

			// Create client with test config
			cfg := &config.Config{
				SupabaseURL:            server.URL,
				SupabaseServiceRoleKey: "test-key",
				HTTPTimeout:            10 * time.Second,
				HTTPMaxIdleConns:       10,
				HTTPMaxConnsPerHost:    5,
				HTTPIdleConnTimeout:    30 * time.Second,
			}
			logger := zap.NewNop()
			client := NewSupabaseClient(cfg, logger)

			// Execute
			data, err := client.Post(context.Background(), tt.endpoint, tt.payload)

			// Assert
			if tt.expectedError != "" {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
				assert.Nil(t, data)
			} else {
				assert.NoError(t, err)
				assert.JSONEq(t, string(tt.expectedData), string(data))
			}
		})
	}
}

func TestSupabaseClient_buildURL(t *testing.T) {
	tests := []struct {
		name        string
		endpoint    string
		queryParams map[string]string
		expectedURL string
		expectError bool
	}{
		{
			name:        "simple_endpoint",
			endpoint:    "/audit_logs",
			queryParams: nil,
			expectedURL: "http://localhost:8000/rest/v1/audit_logs",
			expectError: false,
		},
		{
			name:     "with_query_params",
			endpoint: "/audit_logs",
			queryParams: map[string]string{
				"session_id": "eq.test-session",
				"limit":      "10",
				"order":      "timestamp.desc",
			},
			expectedURL: "http://localhost:8000/rest/v1/audit_logs?limit=10&order=timestamp.desc&session_id=eq.test-session",
			expectError: false,
		},
		{
			name:     "special_characters_in_params",
			endpoint: "/audit_logs",
			queryParams: map[string]string{
				"filter": "name.eq.John Doe",
				"select": "id,name,email",
			},
			expectedURL: "http://localhost:8000/rest/v1/audit_logs?filter=name.eq.John+Doe&select=id%2Cname%2Cemail",
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create client
			cfg := &config.Config{
				SupabaseURL:            "http://localhost:8000",
				SupabaseServiceRoleKey: "test-key",
			}
			logger := zap.NewNop()
			client := NewSupabaseClient(cfg, logger)

			// Execute
			result, err := client.buildURL(tt.endpoint, tt.queryParams)

			// Assert
			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedURL, result)
			}
		})
	}
}

func TestSupabaseError_Error(t *testing.T) {
	err := &SupabaseError{
		Message: "Test error message",
		Details: "Additional details",
		Code:    "TEST001",
	}

	assert.Equal(t, "Test error message", err.Error())
}

func TestNewSupabaseClient(t *testing.T) {
	cfg := &config.Config{
		SupabaseURL:            "http://localhost:8000",
		SupabaseServiceRoleKey: "test-key",
		HTTPTimeout:            30 * time.Second,
		HTTPMaxIdleConns:       100,
		HTTPMaxConnsPerHost:    10,
		HTTPIdleConnTimeout:    90 * time.Second,
	}
	logger := zap.NewNop()

	client := NewSupabaseClient(cfg, logger)

	assert.NotNil(t, client)
	assert.Equal(t, "http://localhost:8000/rest/v1", client.baseURL)
	assert.NotNil(t, client.httpClient)
	assert.NotNil(t, client.headers)
	assert.Equal(t, logger, client.logger)
}
