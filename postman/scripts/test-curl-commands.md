# Test CURL Commands for Address Migration

## 1. First, get an agent ID to work with

```bash
# List agents to get an ID
curl -s "http://localhost:3000/v1/agents?limit=1" | jq '.'

# Or create a test agent
curl -X POST "http://localhost:3000/v1/agents" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "lifecycleStatus": "Active"
  }' | jq '.'
```

## 2. Create an address with countryId and stateCode (USA, Texas)

Replace `{AGENT_ID}` with actual agent ID:

```bash
curl -X POST "http://localhost:3000/v1/agents/{AGENT_ID}/addresses" \
  -H "Content-Type: application/json" \
  -d '{
    "isPrimary": true,
    "type": "personal",
    "role": "contact",
    "line1": "123 Main Street",
    "line2": "Suite 100",
    "city": "Austin",
    "postalCode": "78701",
    "county": "Travis",
    "label": "Home Office",
    "countryId": 1,
    "stateCode": "TX"
  }' | jq '.'
```

## 3. Get the address to see virtual state projection

Replace `{AGENT_ID}` and `{ADDRESS_ID}` with actual IDs:

```bash
curl "http://localhost:3000/v1/agents/{AGENT_ID}/addresses/{ADDRESS_ID}" | jq '.'
```

Expected: The response should include the address with both `countryId`, `stateCode`, and a virtual `state` object populated from the join.

## 4. List all addresses with projections

```bash
# Basic list
curl "http://localhost:3000/v1/agents/{AGENT_ID}/addresses" | jq '.'

# With state and country included
curl "http://localhost:3000/v1/agents/{AGENT_ID}/addresses?include=address.state,address.country" | jq '.'
```

## 5. Create international address (Canada, no state)

```bash
curl -X POST "http://localhost:3000/v1/agents/{AGENT_ID}/addresses" \
  -H "Content-Type: application/json" \
  -d '{
    "isPrimary": false,
    "type": "personal",
    "role": "contact",
    "line1": "456 Maple Avenue",
    "city": "Toronto",
    "postalCode": "M5V 3A8",
    "label": "Canada Office",
    "countryId": 2,
    "stateCode": null
  }' | jq '.'
```

## 6. Update address to change state

```bash
# Change from Texas to California
curl -X PUT "http://localhost:3000/v1/agents/{AGENT_ID}/addresses/{ADDRESS_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "city": "San Francisco",
    "postalCode": "94102",
    "stateCode": "CA"
  }' | jq '.'
```

## 7. Get agent with primaryAddress (virtual state loading)

```bash
curl "http://localhost:3000/v1/agents/{AGENT_ID}?include=primaryAddress" | jq '.primaryAddress'
```

## 8. Test filtering by country

```bash
# Search addresses in USA
curl "http://localhost:3000/v1/addresses?filter={\"countryId\":{\"eq\":1}}" | jq '.'

# Search addresses with state code TX
curl "http://localhost:3000/v1/addresses?filter={\"stateCode\":{\"eq\":\"TX\"}}" | jq '.'
```

## 9. Error Testing - Missing required countryId

```bash
# This should fail - countryId is required
curl -X POST "http://localhost:3000/v1/agents/{AGENT_ID}/addresses" \
  -H "Content-Type: application/json" \
  -d '{
    "isPrimary": true,
    "line1": "789 Oak Street",
    "city": "Dallas",
    "postalCode": "75201",
    "stateCode": "TX"
  }' | jq '.'
```

## Expected Behavior

### ✅ What should work:
- Creating addresses with `countryId` (number) and `stateCode` (string)
- Getting addresses returns virtual `state` object
- International addresses with `stateCode: null`
- Updating `stateCode` to change states
- Virtual state loading in projections

### ❌ What should fail:
- Creating address without `countryId`
- Using old `stateId` field (removed from schema)
- Invalid `stateCode` that doesn't match country

## Quick Test Script

Save this as `quick-test.sh`:

```bash
#!/bin/bash
AGENT_ID="YOUR_AGENT_ID_HERE"
BASE_URL="http://localhost:3000/v1"

# Create US address
echo "Creating US address with state..."
curl -X POST "${BASE_URL}/agents/${AGENT_ID}/addresses" \
  -H "Content-Type: application/json" \
  -d '{
    "isPrimary": true,
    "line1": "123 Test St",
    "city": "Austin",
    "postalCode": "78701",
    "countryId": 1,
    "stateCode": "TX"
  }' | jq '.'

# List to see virtual state
echo -e "\nListing addresses (should show virtual state)..."
curl "${BASE_URL}/agents/${AGENT_ID}/addresses" | jq '.items[0].address.state'
```