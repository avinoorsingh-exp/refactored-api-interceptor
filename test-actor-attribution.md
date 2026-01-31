# Testing Actor Attribution Locally

This guide helps you test that `actor_id` is being populated correctly in `api_request_log` without deploying.

## Quick Test

1. **Start your local server** (if not already running)

2. **Make a test request** to any endpoint:
   ```bash
   curl http://localhost:3002/api/v1/api-monitoring/debug/context
   ```

3. **Check the response** - it should show:
   ```json
   {
     "context": {
       "exists": true,
       "correlationId": "...",
       "actorId": "...",  // <-- This should be populated
       "actorType": "SYSTEM",  // or USER, API_KEY, etc.
       ...
     },
     "request": {
       "apiActor": {
         "id": "...",  // <-- Should match context.actorId
         "type": "..."
       }
     },
     "diagnostics": {
       "hasContext": true,
       "hasActorId": true,
       "hasReqActor": true,
       "contextActorMatches": true  // <-- Should be true
     }
   }
   ```

## Detailed Testing Steps

### Step 1: Check Context State

Call the debug endpoint:
```bash
curl http://localhost:3002/api/v1/api-monitoring/debug/context
```

**Expected:**
- `context.exists` = `true`
- `context.actorId` = a UUID (not null/undefined)
- `context.actorType` = `"SYSTEM"` (in local dev)
- `diagnostics.contextActorMatches` = `true`

**If `actorId` is missing:**
- Check console logs for: `[ApiRequestContextService] CRITICAL: Cannot update actor - context is undefined`
- This indicates the context wasn't created or was lost

### Step 2: Check Database (if monitoring is enabled)

Even if monitoring is disabled locally, you can check if the flow works:

1. **Query the database** to see if `actor_id` would be populated:
   ```sql
   -- Check recent api_request_log entries
   SELECT 
     id,
     route,
     method,
     actor_id,  -- <-- Should NOT be null
     actor_type,
     timestamp,
     created_at
   FROM core.api_request_log
   ORDER BY created_at DESC
   LIMIT 10;
   ```

2. **Check api_actor table** to see if actors are being created:
   ```sql
   SELECT 
     id,
     type,
     identifier,
     display_name,
     active,
     created_at
   FROM core.api_actor
   ORDER BY created_at DESC
   LIMIT 10;
   ```

### Step 3: Enable Monitoring Temporarily (Optional)

If you want to actually write to the database locally:

1. **Set environment variable:**
   ```bash
   export API_MONITORING_ENABLED=true
   ```

2. **Make a test request:**
   ```bash
   curl http://localhost:3002/api/v1/health
   ```

3. **Check the database:**
   ```sql
   SELECT actor_id, actor_type, route, method 
   FROM core.api_request_log 
   WHERE route = '/v1/health' 
   ORDER BY created_at DESC 
   LIMIT 1;
   ```

   The `actor_id` should be populated (not null).

### Step 4: Check Logs

Watch your console output for:

1. **Actor resolution logs:**
   ```
   [ApiActorMiddleware] Resolved actor identity { actorId: '...', actorType: 'SYSTEM', ... }
   ```

2. **Context update logs:**
   ```
   [ApiRequestContextService] CRITICAL: Cannot update actor - context is undefined
   ```
   (This should NOT appear - if it does, there's a problem)

3. **Metadata build logs:**
   ```
   [ApiMonitoringService] buildRequestMetadata: No actorId in context
   ```
   (This should NOT appear if everything is working)

## Troubleshooting

### Issue: `context.exists` = `false`

**Cause:** `CorrelationIdMiddleware` didn't create the context.

**Fix:** Check middleware registration order in `app.module.ts`:
```typescript
consumer
  .apply(CorrelationIdMiddleware)  // Must be FIRST
  .forRoutes('*')

consumer
  .apply(ApiActorMiddleware)  // Must be SECOND
  .forRoutes('*')
```

### Issue: `context.actorId` = `null` but `context.exists` = `true`

**Cause:** `updateActor()` failed silently (context was undefined when called).

**Fix:** Check console for the CRITICAL error message. This indicates:
- Context was lost between middleware
- Middleware ordering issue
- Async context propagation problem

### Issue: `diagnostics.contextActorMatches` = `false`

**Cause:** Actor ID in context doesn't match `req.apiActor.id`.

**Fix:** This indicates a timing issue or context corruption. Check:
- Middleware execution order
- Async context storage implementation
- Any code that modifies the context

## Test Script

You can also create a simple test script:

```bash
#!/bin/bash
# test-actor.sh

echo "Testing actor attribution..."

# Test 1: Debug endpoint
echo "1. Checking context state..."
RESPONSE=$(curl -s http://localhost:3002/api/v1/api-monitoring/debug/context)
echo "$RESPONSE" | jq '.'

# Extract actorId
ACTOR_ID=$(echo "$RESPONSE" | jq -r '.context.actorId')

if [ "$ACTOR_ID" = "null" ] || [ -z "$ACTOR_ID" ]; then
  echo "❌ FAIL: actorId is missing"
  exit 1
else
  echo "✅ PASS: actorId = $ACTOR_ID"
fi

# Test 2: Make a real request
echo "2. Making test request..."
curl -s http://localhost:3002/api/v1/health > /dev/null

echo "✅ Test complete. Check database to verify actor_id was populated."
```

Run it:
```bash
chmod +x test-actor.sh
./test-actor.sh
```





