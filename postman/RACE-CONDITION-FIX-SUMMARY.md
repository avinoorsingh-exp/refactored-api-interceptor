# Race Condition & Conflict Handling Fixes

## Overview
Fixed critical issues where concurrent requests and unique constraint violations caused 500 Internal Server Errors instead of proper 409 Conflict responses.

## Problems Identified

### 1. Race Conditions in POST Requests
**Issue:** When multiple POST requests tried to create resources with the same unique field (e.g., company name), the manual duplicate check had a race condition between the `findOne` check and the `save` operation.

**Impact:** Could result in duplicate records being created.

**Solution:** Database unique constraints catch this at the DB level and return proper 409 Conflict errors.

### 2. PUT Requests Causing 500 Errors
**Issue:** When a PUT request tried to update a resource with data that violated a unique constraint (e.g., updating Country US to have Canada's alpha3 code "CAN"), the application crashed with a 500 Internal Server Error instead of returning 409 Conflict.

**Root Cause:** Services (Countries, Regions) didn't handle `QueryFailedError` exceptions from the database when unique constraints were violated.

**Impact:** Poor user experience, unclear error messages, and potential data corruption concerns.

## Changes Made

### 1. Added Unique Constraints to Entities

**CompanyEntity** (`packages/database/src/entities/core/company.entity.ts`):
- ✅ `name` - unique: true (ADDED)
- ✅ `email` - unique: true (already existed)

**RegionEntity** (`packages/database/src/entities/core/region.entity.ts`):
- ✅ `name` - unique: true (ADDED)

**CountryEntity** (`packages/database/src/entities/core/country.entity.ts`):
- ✅ `alpha2` - unique: true (already existed)
- ✅ `alpha3` - unique: true (already existed)  
- ✅ `number` - unique: true (already existed)

### 2. Created Database Migrations

- `1763138600000-AddUniqueConstraintToCompanyName.ts` - Adds unique constraint on company.name
- `1763138610000-AddUniqueConstraintToRegionName.ts` - Adds unique constraint on region.name

### 3. Enhanced Error Handling in Services

**Centralized Approach:** All database constraint violations are handled by the **global `ProblemDetailsFilter`** which uses `DatabaseErrorHandler` to transform `QueryFailedError` exceptions into proper HTTP responses.

**DatabaseErrorHandler** (`services/agent-service/src/errors/database-error.handler.ts`):
- Detects PostgreSQL error code `23505` (unique constraint violation)
- Parses constraint name and error detail to identify conflicting field
- Transforms to `ConflictException` with descriptive message
- Automatically applied to all controllers via global exception filter

**Services removed redundant error handling:**
- ✅ CompaniesService - Removed QueryFailedError handling (relies on global filter)
- ✅ RegionsService - Removed QueryFailedError handling (relies on global filter)
- ✅ CountriesService - Removed QueryFailedError handling (relies on global filter)

**Benefits:**
- DRY (Don't Repeat Yourself) - Error handling logic in one place
- Consistent error responses across all endpoints
- Easier to maintain and update error messages
- Services focus on business logic, not infrastructure concerns

### 4. Created Comprehensive Test Collection

**File:** `postman/race-condition-tests.postman_collection.json`

**Structure:**
- **Folder 1: Race Condition Tests (Without Fix)** - Tests that would fail before the fix
  - Companies POST Race Condition
  - Companies PUT Conflict
  - Regions POST Race Condition
  - Regions PUT Conflict
  - Countries PUT Conflict

- **Folder 2: With 409 Conflict Fix** - Tests verifying proper error handling
  - Companies: POST duplicate name, POST duplicate email, PUT duplicate name
  - Regions: POST duplicate name, PUT duplicate name
  - Countries: PUT duplicate alpha2, PUT duplicate alpha3, PUT duplicate number

## How to Test

### Using Postman Collection

1. Import `postman/race-condition-tests.postman_collection.json`
2. Set environment variable: `base_url = http://localhost:3000`
3. Run **Folder 1** tests BEFORE applying migrations (should see 500 errors on PUT conflicts)
4. Apply migrations: `pnpm migration:run`
5. Restart the service
6. Run **Folder 2** tests (should see 409 Conflicts with descriptive messages)

### Manual Testing

**Test Race Condition Fix:**
```bash
# Send 5 concurrent POST requests with same company name
for i in {1..5}; do
  curl -X POST http://localhost:3000/v1/companies \
    -H "Content-Type: application/json" \
    -d '{"name":"Concurrent Test","email":"test'$i'@example.com"}' &
done
```
**Expected Result:** Only one succeeds (201), others return 409 Conflict

**Test PUT Conflict Handling:**
```bash
# Create two companies
curl -X POST http://localhost:3000/v1/companies \
  -H "Content-Type: application/json" \
  -d '{"name":"Company A","email":"a@example.com"}'

curl -X POST http://localhost:3000/v1/companies \
  -H "Content-Type: application/json" \
  -d '{"name":"Company B","email":"b@example.com"}'

# Try to update Company A with Company B's name
curl -X PUT http://localhost:3000/v1/companies/{company_a_id} \
  -H "Content-Type: application/json" \
  -d '{"name":"Company B","email":"a@example.com"}'
```
**Expected Result:** 409 Conflict with message "A company with name 'Company B' already exists"

## Error Response Format

All 409 Conflict responses follow this format:
```json
{
  "statusCode": 409,
  "message": "A company with name 'Test Company' already exists",
  "i18nType": "agent.company.duplicate_name"
}
```

## Technical Details

### PostgreSQL Unique Constraint Error Code
- **Code:** 23505
- **Meaning:** unique_violation
- **Detail:** Contains information like `Key (name)=(Test Company) already exists.`

### Error Parsing Logic
Services parse the `detail` field to identify which column caused the conflict:
- Companies: Checks for `(email)` or `(name)`
- Regions: Only has `(name)`
- Countries: Checks for `(alpha2)`, `(alpha3)`, or `(number)`

## Benefits

1. **Better User Experience:** Clear 409 Conflict errors instead of cryptic 500 errors
2. **Data Integrity:** Database enforces uniqueness at the lowest level
3. **Race Condition Safe:** Concurrent requests properly handled
4. **Informative Errors:** Messages tell users exactly which field conflicts
5. **Consistent Behavior:** All controllers handle conflicts the same way

## Migration Required

⚠️ **IMPORTANT:** These changes require database migrations:

```bash
pnpm migration:run
```

This will add unique constraints on:
- `core.company.name`
- `core.region.name`

## Rollback Instructions

If needed, rollback using:
```bash
pnpm migration:revert
```

This will remove the unique constraints.
