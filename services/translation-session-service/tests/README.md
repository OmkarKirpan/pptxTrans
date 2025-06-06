# Translation Session Service Tests

This directory contains comprehensive tests for the Translation Session Service, covering all critical functionality without performance, load, or security testing infrastructure.

## Test Structure

```
tests/
├── unit/                    # Unit tests for individual components
│   ├── models/             # Model validation tests
│   ├── controllers/        # Controller logic tests
│   └── middleware/         # Middleware functionality tests
├── integration/            # Integration tests
│   ├── api/               # API endpoint tests
│   ├── database/          # Database integration tests
│   └── error-handling/    # Error handling tests
├── e2e/                   # End-to-end tests
│   └── workflows/         # Complete user workflow tests
└── utils/                 # Test utilities and helpers
    ├── test-helpers.ts    # Common test utilities
    └── mock-supabase.ts   # Supabase mocking utilities
```

## Running Tests

### All Tests
```bash
bun test
```

### Test Categories
```bash
# Unit tests only
bun run test:unit

# Integration tests only
bun run test:integration

# End-to-end tests only
bun run test:e2e

# Watch mode
bun run test:watch
```

### Individual Test Files
```bash
# Specific test file
bun test tests/unit/models/validation.test.ts

# Specific test pattern
bun test --grep "should validate"
```

## Test Categories

### 1. Unit Tests (85%+ Coverage Target)

#### Model Validation (`tests/unit/models/`)
- **validation.test.ts**: Zod schema validation tests
  - createSessionSchema validation (valid/invalid inputs)
  - updateSessionSchema validation (partial updates, enum values)
  - Edge cases and error messages

#### Controller Logic (`tests/unit/controllers/`)
- **session-controller.test.ts**: Business logic tests
  - Authentication helper functions
  - CRUD operations with mocked dependencies
  - Error handling and validation
  - Database interaction patterns

#### Middleware (`tests/unit/middleware/`)
- **auth.test.ts**: Authentication middleware tests
  - JWT token validation
  - Error handling for invalid/expired tokens
  - User context setting

### 2. Integration Tests

#### API Endpoints (`tests/integration/api/`)
- **sessions.test.ts**: HTTP API integration tests
  - Request/response format validation
  - Authentication header handling
  - CORS configuration
  - Parameter validation
  - HTTP status codes

#### Database Integration (`tests/integration/database/`)
- **supabase.test.ts**: Database integration tests
  - Connection handling
  - Row Level Security (RLS) validation
  - Data integrity constraints
  - Query operations (CRUD)
  - Error handling

#### Error Handling (`tests/integration/error-handling/`)
- **http-errors.test.ts**: Comprehensive error scenarios
  - 400 Bad Request (validation errors)
  - 401 Unauthorized (authentication failures)
  - 404 Not Found (missing resources)
  - 500 Internal Server Error (system failures)
  - Error response format consistency

### 3. End-to-End Tests

#### Workflows (`tests/e2e/workflows/`)
- **session-lifecycle.test.ts**: Complete user workflows
  - Full session CRUD lifecycle
  - Multi-user isolation scenarios
  - Pagination and filtering workflows
  - Error recovery patterns
  - Service health verification

## Test Utilities

### Test Helpers (`tests/utils/test-helpers.ts`)
- **Data Factories**: Create valid/invalid test data
- **Mock Context**: Simulate Hono.js request context
- **Response Utilities**: Extract and validate API responses
- **Assertion Helpers**: Common test assertions

### Mock Supabase (`tests/utils/mock-supabase.ts`)
- **MockSupabaseClient**: Complete Supabase client simulation
- **Query Builder**: Mock database operations
- **Authentication**: Mock JWT validation
- **Error Simulation**: Database and auth error scenarios

## Test Configuration

### Environment Setup
Tests use mock configurations to avoid requiring real Supabase connections:

```typescript
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.PORT = '3003'; // Unique port for tests
```

### Mock Strategy
- **Unit Tests**: Full mocking of external dependencies
- **Integration Tests**: Real service with mocked external services
- **E2E Tests**: Real service with simulated external interactions

## Test Data Patterns

### Valid Test Data
```typescript
const validSession = {
  session_name: 'Test Session',
  source_language_code: 'en',
  target_language_codes: ['es', 'fr'],
  slide_count: 10,
};
```

### Test User
```typescript
const testUser = {
  id: 'user-456',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'test@example.com',
};
```

### Error Scenarios
- Missing required fields
- Invalid data types
- Authentication failures
- Database constraints
- Network errors

## Best Practices

### Test Organization
1. **Group related tests** using `describe` blocks
2. **Use descriptive test names** that explain expected behavior
3. **Follow AAA pattern**: Arrange, Act, Assert
4. **Clean up** test data between runs

### Assertions
1. **Test status codes** for all API responses
2. **Validate response format** and required fields
3. **Check error messages** for clarity and consistency
4. **Verify side effects** (data persistence, state changes)

### Error Testing
1. **Test all error paths** not just success scenarios
2. **Verify error response format** consistency
3. **Test error recovery** workflows
4. **Validate error logging** (when applicable)

## Coverage Goals

- **Unit Tests**: 85%+ line coverage
- **Integration Tests**: All API endpoints and error paths
- **E2E Tests**: Complete user workflows
- **Error Handling**: All error scenarios and recovery paths

## Continuous Integration

### Pre-commit Checks
```bash
# Lint and format
bun run lint
bun run format

# Type checking
bun run type-check

# Run tests
bun test
```

### Test Reports
- Coverage reports generated automatically
- Test results in standardized format
- Integration with CI/CD pipelines

## Troubleshooting

### Common Issues

1. **Port Conflicts**: Tests use ports 3003-3004, ensure they're available
2. **Mock Setup**: Verify mock data matches expected formats
3. **Async Operations**: Use proper async/await patterns
4. **Test Isolation**: Ensure tests don't interfere with each other

### Debug Mode
```bash
# Verbose test output
bun test --verbose

# Single test debugging
bun test tests/unit/controllers/session-controller.test.ts --verbose
```

### Mock Debugging
Enable mock debugging by setting environment variables:
```bash
DEBUG_MOCKS=true bun test
```

This comprehensive test suite ensures the Translation Session Service is reliable, maintainable, and ready for production deployment.