# Postman Scripts & Testing

This directory contains test scripts and utilities for testing API endpoints.
**This directory is gitignored** - scripts here are for local testing only.

## Contents

### Migration Testing
- `test-address-migration.sh` - Automated test script for state-to-country migration
- `test-curl-commands.md` - Manual curl commands for testing address endpoints
- `check-migration.sql` - SQL queries to verify database migration status

## State-to-Country Migration Test

The address and license tables have been migrated from `stateId` (UUID) to `countryId` + `stateCode` pattern.

### Quick Test

1. **Run automated test:**
   ```bash
   bash test-address-migration.sh
   ```

2. **Or test manually with single command:**
   ```bash
   # Get an agent ID first
   AGENT_ID=$(curl -s "http://localhost:3000/v1/agents?limit=1" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

   # Create address with new fields
   curl -X POST "http://localhost:3000/v1/agents/${AGENT_ID}/addresses" \
     -H "Content-Type: application/json" \
     -d '{
       "isPrimary": true,
       "line1": "123 Test St",
       "city": "Austin",
       "postalCode": "78701",
       "countryId": 1,
       "stateCode": "TX"
     }'
   ```

### What Changed

**Before (old):**
- `stateId`: UUID reference to state table

**After (new):**
- `countryId`: Integer reference to country table (required)
- `stateCode`: 2-letter state code (optional, for US/Canada)
- `state`: Virtual property populated via composite JOIN

### Country IDs
- `1` = United States
- `2` = Canada
- Others: Check `core.country` table

### State Codes (US)
- `TX` = Texas
- `CA` = California
- `NY` = New York
- etc.

### Testing Checklist

- [x] Create US address with state
- [x] Create international address (no state)
- [x] Virtual state loads in GET responses
- [x] Update address state code
- [x] Primary address projection works
- [x] Old `stateId` field rejected

## Database Verification

To check migration status:
```sql
-- Run check-migration.sql in DBeaver
-- or via psql:
psql -h localhost -p 5433 -U postgres -d agent_database -f check-migration.sql
```

## Notes

- Server must be running on http://localhost:3000
- Database must be on port 5433
- Python3 required for JSON formatting (optional)
- jq can be used instead of python for JSON: `| jq '.'`