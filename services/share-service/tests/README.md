# Share Service Test Suite

A comprehensive test suite for the Share Service, covering unit tests, integration tests, security tests, and error handling scenarios.

## Test Structure

```
tests/
├── setup.ts                     # Global test setup and configuration
├── fixtures/                    # Test data and sample objects
│   └── shareData.ts
├── helpers/                     # Test utilities and helper functions
│   └── testHelpers.ts
├── mocks/                       # Mock implementations
│   └── supabase.ts
├── unit/                        # Unit tests
│   ├── controllers/
│   │   └── shareController.test.ts
│   ├── middleware/
│   │   ├── authMiddleware.test.ts
│   │   └── errorHandler.test.ts
│   ├── repository/
│   │   └── shareRepository.test.ts
│   └── utils/
│       └── jwt.test.ts
├── integration/                 # Integration tests
│   └── api/
│       └── shareApi.test.ts
├── security/                    # Security-focused tests
│   └── auth.test.ts
└── resilience/                  # Error handling and resilience tests
    └── errorHandling.test.ts
```

## Test Categories

### Unit Tests
- **JWT Utils**: Token generation, verification, error handling
- **Repository Layer**: Database operations, error scenarios, data consistency
- **Middleware**: Authentication, error handling, validation
- **Controllers**: Request handling, business logic, response formatting

### Integration Tests
- **API Endpoints**: Full request/response cycles
- **Rate Limiting**: Enforcement across different endpoints
- **CORS & Security Headers**: Cross-origin and security configurations
- **Error Propagation**: End-to-end error handling

### Security Tests
- **Authentication**: Token validation, malformed requests
- **Authorization**: User isolation, permission enforcement
- **Input Validation**: SQL injection prevention, XSS protection
- **Information Disclosure**: Error message sanitization

### Resilience Tests
- **Database Failures**: Connection timeouts, partial failures
- **Service Dependencies**: Auth service, JWT service failures
- **Resource Exhaustion**: Memory limits, large payload handling
- **Concurrent Operations**: Race conditions, deadlock prevention

## Running Tests

### All Tests
```bash
# Run all tests
bun run test

# Run tests once (no watch mode)
bun run test:run

# Run with coverage report
bun run test:coverage
```

### Specific Test Categories
```bash
# Unit tests only
bun run test:unit

# Integration tests only
bun run test:integration

# Security and resilience tests
bun run test:security
```

### Watch Mode
```bash
# Run tests in watch mode during development
bun run test:watch
```

## Test Configuration

### Environment Variables
Required for testing:
```bash
TEST_SUPABASE_URL=http://localhost:54321
TEST_SUPABASE_ANON_KEY=test-anon-key
TEST_SHARE_TOKEN_SECRET=test-secret-key-for-jwt-testing
```

### Coverage Thresholds
- **Branches**: 80%
- **Functions**: 85%
- **Lines**: 85%
- **Statements**: 85%

## Test Features

### Comprehensive Mocking
- **Supabase Client**: Complete database operation mocking
- **JWT Library**: Token generation and verification mocking
- **HTTP Requests**: Request/response mocking with Hono

### Realistic Test Scenarios
- **Authentication Flows**: Valid/invalid tokens, expired tokens
- **Database Operations**: CRUD operations, constraint violations
- **Error Conditions**: Network failures, service unavailability
- **Security Scenarios**: Cross-user access attempts, input validation

### Performance Testing
- **Rate Limiting**: Verification of limits per IP and endpoint
- **Concurrent Requests**: Race condition and deadlock testing
- **Resource Usage**: Memory and CPU usage under load

## Test Data Management

### Fixtures
- **Valid Requests**: Properly formatted request bodies
- **Invalid Requests**: Various malformed inputs for validation testing
- **Database Records**: Sample share records, user data, session data
- **JWT Payloads**: Valid and invalid token payloads

### Helper Functions
- **Context Creation**: Mock Hono context with authentication
- **Response Validation**: Structured response checking
- **Database State**: Setup and teardown utilities
- **Token Generation**: Test JWT creation

## Error Testing Strategy

### Expected Errors
- Validation errors (400)
- Authentication failures (401)
- Authorization failures (403)
- Resource not found (404)
- Rate limiting (429)
- Server errors (500)

### Unexpected Errors
- Database connection failures
- Authentication service downtime
- Memory exhaustion
- Network partitions

## Security Testing Focus

### Authentication Security
- Token format validation
- Signature verification
- Expiry enforcement
- Replay attack prevention

### Authorization Security
- User isolation verification
- Permission level enforcement
- Cross-tenant access prevention
- Privilege escalation attempts

### Input Security
- SQL injection attempts
- XSS payload handling
- Path traversal prevention
- JSON structure validation

## Maintenance Guidelines

### Adding New Tests
1. Follow the existing directory structure
2. Use consistent naming conventions
3. Include both positive and negative test cases
4. Mock external dependencies appropriately
5. Ensure tests are deterministic and isolated

### Updating Tests
1. Maintain backward compatibility with existing APIs
2. Update fixtures when data structures change
3. Verify coverage thresholds are maintained
4. Test both old and new behavior during transitions

### Performance Considerations
1. Keep tests focused and fast
2. Mock external services completely
3. Use appropriate test timeouts
4. Clean up resources after tests

## CI/CD Integration

### Pre-commit Hooks
- Run unit tests
- Verify code coverage
- Lint test files

### Pull Request Checks
- Full test suite execution
- Coverage report generation
- Security test validation

### Deployment Gates
- All tests must pass
- Coverage thresholds must be met
- Security tests must pass

## Debugging Test Failures

### Common Issues
1. **Mock Setup**: Ensure all external dependencies are mocked
2. **Async Operations**: Use proper async/await patterns
3. **State Isolation**: Clean up between tests
4. **Environment Variables**: Verify test environment setup

### Debug Tools
1. **Detailed Logging**: Enable verbose test output
2. **Coverage Reports**: Identify untested code paths
3. **Performance Profiling**: Monitor test execution times
4. **Error Stack Traces**: Full error information in failures

## Contributing

When adding new features to the Share Service:

1. **Write Tests First**: Follow TDD approach
2. **Cover Edge Cases**: Include error scenarios
3. **Security Review**: Add security-focused tests
4. **Documentation**: Update test documentation
5. **Coverage**: Maintain or improve coverage metrics

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Hono Testing Guide](https://hono.dev/getting-started/testing)
- [Supabase Testing](https://supabase.com/docs/guides/getting-started/local-development)
- [JWT Testing Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)