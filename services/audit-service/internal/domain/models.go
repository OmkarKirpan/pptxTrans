package domain

import "time"

// EventResponse represents the response for creating an audit event
type EventResponse struct {
	ID        string    `json:"id"`
	SessionID string    `json:"sessionId"`
	UserID    string    `json:"userId"`
	Type      string    `json:"type"`
	Timestamp time.Time `json:"timestamp"`
	Success   bool      `json:"success"`
}
