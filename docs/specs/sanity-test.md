# Sanity Test - Agent Service Test Environment

**Version**: 1.0  
**Created**: November 5, 2025  
**Environment**: Test Environment  
**Purpose**: Verify core functionality and infrastructure after deployment

---

## Description

A sanity test suite to validate that the Agent Service is properly deployed and operational in the test environment. This test ensures that critical API endpoints, database connectivity, caching layer, and core business logic are functioning correctly before full QA testing begins.

The sanity test focuses on "smoke testing" the most critical paths through the system to quickly identify any deployment or configuration issues that would block further testing.

---

## Scope

### In Scope
- Health check endpoints
- Database connectivity and schema validation
- Core CRUD operations (Countries, Companies, Regions)
- Request/response validation
- Error handling and RFC 9457 Problem Details
- Swagger API documentation accessibility
- Basic authentication/authorization (if applicable)

### Out of Scope
- Comprehensive functional testing
- Performance/load testing
- Security testing
- Edge case validation
- Complex business logic workflows

---

## Acceptance Criteria

### AC1: Infrastructure Health Checks
**Given** the Agent Service is deployed to the test environment  
**When** health check endpoints are called  
**Then**:
- `GET /health` returns 200 OK
- Response includes service name and version
- Database connection status is "healthy"
- Redis connection status is "healthy"
- Response time < 500ms

### AC2: API Documentation Availability
**Given** the Agent Service is running  
**When** accessing the Swagger documentation  
**Then**:
- `GET /api` returns 200 OK and displays Swagger UI
- All endpoint groups are visible (Countries, Companies, Regions)
- API version and title match expected values
- All endpoints show proper request/response schemas

### AC3: Database Connectivity and Schema
**Given** the database migrations have been applied  
**When** querying the database  
**Then**:
- Core schema exists
- All 48 expected tables are present in the `core` schema
- Migration tracking table exists with latest migration recorded
- Database accepts connections from the service

### AC4: Countries Endpoints (Read Operations)
**Given** the database is seeded with 249 ISO countries  
**When** testing Countries endpoints  
**Then**:
- `GET /v1/countries/US` returns 200 OK with United States data
- `GET /v1/countries/CA` returns 200 OK with Canada data
- `GET /v1/countries/XX` returns 404 Not Found with proper error format
- `GET /v1/countries/invalid` returns 400 Bad Request with validation error
- All responses follow RFC 9457 Problem Details format for errors

### AC5: Countries Endpoints (Write Operations)
**Given** valid country data  
**When** creating/updating countries  
**Then**:
- `POST /v1/countries` with valid data returns 201 Created
- Response includes Location header with resource URL
- `POST /v1/countries` with duplicate code returns 409 Conflict
- `PUT /v1/countries/{code}` updates existing country returns 200 OK
- `PUT /v1/countries/{newcode}` creates new country returns 201 Created
- All validation errors return 400 Bad Request with detailed error messages

### AC6: Companies Endpoints (Full CRUD)
**Given** the Companies module is deployed  
**When** testing all CRUD operations  
**Then**:
- `POST /v1/companies` creates new company, returns 201 Created with Location header
- `GET /v1/companies/{id}` retrieves company by UUID, returns 200 OK
- `PUT /v1/companies/{id}` updates existing company, returns 200 OK
- Name normalization works (case-insensitive duplicate detection)
- Email validation enforces proper format
- Duplicate name returns 409 Conflict
- Invalid UUID returns 400 Bad Request
- Non-existent UUID returns 404 Not Found

### AC7: Regions Endpoints (Full CRUD)
**Given** the Regions module is deployed  
**When** testing all CRUD operations  
**Then**:
- `POST /v1/regions` creates new region, returns 201 Created with Location header
- `GET /v1/regions/{id}` retrieves region by bigint ID, returns 200 OK
- `PUT /v1/regions/{id}` updates existing region, returns 200 OK
- Name normalization works (lowercase trim for uniqueness)
- Duplicate name returns 409 Conflict
- Invalid ID format returns 400 Bad Request
- Non-existent ID returns 404 Not Found
- Name length validation enforces 1-255 characters

### AC8: Error Response Consistency
**Given** any API error condition  
**When** an error occurs  
**Then**:
- Response follows RFC 9457 Problem Details format
- Contains `type`, `status`, `title`, `detail` fields
- `type` field contains machine-readable i18n key (e.g., `agent.company.not_found`)
- Validation errors include `invalidParams` array with field-level details
- HTTP status code matches the `status` field in response body
- Content-Type is `application/problem+json`

### AC9: Request Validation
**Given** any API endpoint with validation rules  
**When** invalid data is submitted  
**Then**:
- Empty required fields return 400 Bad Request
- Invalid formats (email, UUID, numeric string) return 400 Bad Request
- Out-of-range values return 400 Bad Request
- Validation error messages are clear and field-specific
- All validation powered by Zod schemas from shared-domain package

### AC10: Service Logs and Monitoring
**Given** the service is processing requests  
**When** reviewing application logs  
**Then**:
- Logs are in JSON format (structured logging)
- Log level is appropriate for test environment (debug/info)
- Request/response logging captures key details
- Error logs include stack traces
- No sensitive data (passwords, tokens) in logs
- Logs are accessible via standard logging infrastructure

---

## Test Data Requirements

### Pre-existing Data
- 249 ISO 3166-1 countries from initial migration
- At least 1 test company for GET operations
- At least 1-3 test regions for GET operations

### Test Data to Create
- 2-3 new test companies with unique names/emails
- 2-3 new test regions with unique names
- 1-2 test countries with non-ISO codes for create/update testing

### Cleanup
- All test data created should be clearly identifiable (e.g., prefix with "TEST_")
- Test data cleanup strategy should be documented
- Consider using transaction rollback for read-only sanity tests

---

## Execution Steps

### 1. Pre-Test Verification
```bash
# Verify service is running
curl http://test-env-url/health

# Verify database connectivity
# (Check via admin tools or health endpoint)

# Verify Swagger is accessible
curl http://test-env-url/api
```

### 2. Run Postman Collection
- Import `postman_collection.json`
- Configure environment with `baseUrl` = test environment URL
- Run entire collection and verify all tests pass
- Review test results for any failures

### 3. Manual Verification
- Access Swagger UI and verify documentation loads
- Test 2-3 endpoints manually via Swagger UI
- Check application logs for errors
- Verify database has expected data

### 4. Post-Test Verification
- Confirm no error logs during sanity test execution
- Verify service is still healthy after test run
- Check database connection pool status
- Review performance metrics (if available)

---

## Success Criteria

**The sanity test passes if:**
- All 10 acceptance criteria are met
- 100% of Postman collection tests pass
- No ERROR-level logs during test execution
- Service remains stable throughout test execution
- Health check endpoint remains responsive

**The sanity test fails if:**
- Any acceptance criteria fails
- More than 5% of Postman tests fail
- Service becomes unresponsive during testing
- Database connectivity issues occur
- Critical errors appear in logs

---

## Failure Response

If sanity test fails:
1. **Stop further testing** - Do not proceed to full QA
2. **Log defect** with:
   - Failed acceptance criteria
   - Request/response samples
   - Error logs
   - Environment details
3. **Notify deployment team** immediately
4. **Root cause analysis** required before retry
5. **Re-run sanity test** after fixes deployed

---

## Test Environment Details

### Required Configuration
- **Base URL**: `https://test-agent-service.exprealty.com` (or applicable URL)
- **Database**: Test PostgreSQL instance
- **Redis**: Test Redis instance
- **Environment**: `NODE_ENV=test`
- **Log Level**: `LOG_LEVEL=debug`

### Access Requirements
- Network access to test environment
- API endpoint access (no authentication for sanity test, or test credentials)
- Log viewing permissions
- Database read access (for verification)

---

## Test Timeline

**Duration**: 15-20 minutes
- Infrastructure checks: 2 minutes
- Postman collection: 10 minutes
- Manual verification: 5 minutes
- Log review: 3 minutes

**Frequency**:
- After every deployment to test environment
- Before starting QA test cycles
- After infrastructure changes
- After database migrations

---

## Contacts

**On Sanity Test Failure:**
- Deployment Team Lead: [Name]
- Backend Developer: [Name]
- DevOps Engineer: [Name]
- QA Lead: [Name]

---

## Appendix

### Postman Collection Location
- File: `postman_collection.json` in repository root
- Contains 32 test cases covering all acceptance criteria

### Related Documentation
- `DEVELOPER_ONBOARDING.md` - Setup and installation
- `ARCHITECTURE-OVERVIEW.md` - System architecture
- `docs/specs/` - Feature specifications

### Version History
| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-11-05 | Initial sanity test specification |

---

**Last Updated**: November 5, 2025
