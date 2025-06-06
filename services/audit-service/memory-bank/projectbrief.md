<!-- projectbrief.md -->

# Project Brief: Audit Service Microservice

## 1. Introduction
The **Audit Service** is a Go-based microservice that provides read-only access to the audit log history for PowerPoint translation sessions. It serves as the centralized service for retrieving chronological records of all actions performed within a session, enabling transparency and accountability in the translation workflow.

## 2. Core Requirements
1. **Audit Log Retrieval**
   - Fetch paginated audit entries for a given session ID
   - Return entries in reverse chronological order (newest first)
   - Support limit/offset pagination parameters

2. **Authentication & Authorization**
   - Validate JWT tokens issued by Supabase Auth
   - Verify share tokens for reviewer access
   - Implement token caching for performance
   - Ensure users can only access sessions they own or have been shared with

3. **API Contract**
   - Follow OpenAPI 3.0.3 specification (AuditAPI.yaml)
   - Single endpoint: GET /sessions/{sessionId}/history
   - Standardized error responses (401, 403, 404)
   - JSON response format with totalCount and items array

4. **Performance Requirements**
   - Token validation caching to reduce auth overhead
   - Connection pooling for Supabase REST API calls
   - Structured logging with request IDs for debugging
   - Response time target: < 200ms for typical queries

## 3. Technical Decisions
- **Framework**: Gin for HTTP routing and middleware
- **Architecture**: Domain-driven design with clear separation of concerns
- **Data Access**: Supabase REST API (not direct PostgreSQL)
- **Logging**: Zap for structured, high-performance logging
- **Documentation**: OpenAPI/Swagger served at /docs
- **Testing**: Unit tests with mocked dependencies
- **Deployment**: Docker container for consistent environments

## 4. Constraints & Assumptions
- Read-only service (no write operations)
- Audit entries are immutable once created
- All audit data lives in Supabase's audit_logs table
- JWT secrets are available via environment configuration
- Service runs independently from other microservices

## 5. Success Criteria
- Clean API matching the OpenAPI specification exactly
- Comprehensive authentication with proper error codes
- Fast response times with effective caching
- Well-structured, maintainable Go code
- High test coverage (> 80%)
- Clear documentation for operators

--- 