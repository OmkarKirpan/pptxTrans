# Test Session ID Pattern

## Overview

The PowerPoint Translator application supports a special test session ID pattern that makes development and testing easier by bypassing certain authentication and validation requirements that would otherwise be necessary in production environments.

## Test Session ID Format

A test session ID is any session ID that follows this pattern:
```
test-{any-text}
```

Examples:
- `test-session-123`
- `test-development`
- `test-any-arbitrary-string`

## Features and Benefits

Test sessions provide several key benefits for development and testing:

1. **No Authentication Required**: You can create and view audit events without a valid JWT token.
2. **In-Memory Storage**: Test events are stored in memory rather than in the database, making it easy to test without affecting production data.
3. **Auto-Generated User IDs**: For test sessions, the system automatically generates mock user IDs if none is provided.
4. **Ownership Validation Bypass**: Test sessions bypass the ownership validation that would normally verify if a user has access to a session.
5. **Simplified Testing**: Makes it easy to test the audit functionality without setting up full authentication.

## How to Use Test Sessions

### In Frontend Development

When testing audit functionality in the frontend, simply use a session ID that starts with `test-`:

```typescript
// Example using the useAuditLog hook
const { createAuditEvent } = useAuditLog('test-frontend-dev');

// Log an event
createAuditEvent('edit', { 
  slideId: 'slide-1',
  textId: 'text-1',
  before: 'Hello',
  after: 'Hello World'
});
```

### Direct API Testing

When making direct API calls to the audit service:

```bash
# Creating an audit event for a test session
curl -X POST http://localhost:4006/api/v1/events \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-curl-example",
    "type": "edit",
    "details": {
      "slideId": "slide-1", 
      "change": "text update"
    }
  }'
```

### Using the Audit Test Page

The application includes a dedicated test page at `/audit-test` that allows you to:

1. Create test events
2. View audit logs for test sessions
3. Test the offline event queue functionality

## Implementation Details

Test sessions are recognized and handled specially in several parts of the codebase:

1. In the **Events Handler**, test sessions:
   - Generate a mock user ID if none is provided
   - Store events in an in-memory TestEventStore
   - Return a successful response without database interaction

2. In the **Audit Repository**, test sessions:
   - Are recognized by the `strings.HasPrefix(sessionID, "test-")` check
   - Return data from the in-memory store instead of the database

3. In the **Session Validation**, test sessions:
   - Bypass ownership validation checks
   - Do not require database lookups for session ownership

## Limitations

While test sessions are useful for development and testing, they have some limitations:

1. **Persistence**: Test event data is stored in memory and will be lost when the service restarts.
2. **Limited Functionality**: Some advanced features may not be fully available in test mode.
3. **Security**: Test sessions should never be used in production environments as they bypass security checks.

## Best Practices

1. **Naming Convention**: Use descriptive names for test sessions (e.g., `test-offline-queue-testing`) to identify their purpose.
2. **Test Data**: Include realistic test data in your event details to more accurately simulate real usage.
3. **Integration Testing**: Use test sessions for integration testing between the frontend and the audit service. 