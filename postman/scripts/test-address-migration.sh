#!/bin/bash

# Test script for the state-to-country migration with virtual state projection
# Run with: bash test-address-migration.sh

BASE_URL="http://localhost:3000/v1"

echo "============================================"
echo "Testing Address Migration: countryId + stateCode"
echo "============================================"
echo ""

# Step 1: Get first agent ID for testing
echo "1. Getting first agent from the system..."
AGENT_RESPONSE=$(curl -s "${BASE_URL}/agents?limit=1")
AGENT_ID=$(echo $AGENT_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$AGENT_ID" ]; then
    echo "No agents found. Creating a test agent first..."
    AGENT_RESPONSE=$(curl -s -X POST "${BASE_URL}/agents" \
        -H "Content-Type: application/json" \
        -d '{
            "firstName": "Test",
            "lastName": "Agent",
            "lifecycleStatus": "Active",
            "isStaff": false
        }')
    AGENT_ID=$(echo $AGENT_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
fi

echo "Using Agent ID: $AGENT_ID"
echo ""

# Step 2: Create an address with countryId and stateCode (Texas, USA)
echo "2. Creating address with countryId=1 (USA) and stateCode='TX' (Texas)..."
echo "Request:"
echo "POST ${BASE_URL}/agents/${AGENT_ID}/addresses"
cat <<EOF
{
    "isPrimary": true,
    "type": "personal",
    "role": "contact",
    "line1": "123 Main Street",
    "line2": "Suite 100",
    "city": "Austin",
    "unit": null,
    "postalCode": "78701",
    "county": "Travis",
    "label": "Home Office",
    "countryId": 1,
    "stateCode": "TX"
}
EOF
echo ""
echo "Response:"
ADDRESS_RESPONSE=$(curl -s -X POST "${BASE_URL}/agents/${AGENT_ID}/addresses" \
    -H "Content-Type: application/json" \
    -d '{
        "isPrimary": true,
        "type": "personal",
        "role": "contact",
        "line1": "123 Main Street",
        "line2": "Suite 100",
        "city": "Austin",
        "unit": null,
        "postalCode": "78701",
        "county": "Travis",
        "label": "Home Office",
        "countryId": 1,
        "stateCode": "TX"
    }')
echo $ADDRESS_RESPONSE | python3 -m json.tool 2>/dev/null || echo $ADDRESS_RESPONSE
ADDRESS_ID=$(echo $ADDRESS_RESPONSE | grep -o '"addressId":"[^"]*"' | cut -d'"' -f4)
echo ""

# Step 3: Get the created address to verify virtual state projection
echo "3. Getting address to verify virtual state is loaded..."
echo "Request:"
echo "GET ${BASE_URL}/agents/${AGENT_ID}/addresses/${ADDRESS_ID}"
echo ""
echo "Response (check for virtual state object):"
curl -s "${BASE_URL}/agents/${AGENT_ID}/addresses/${ADDRESS_ID}" | python3 -m json.tool 2>/dev/null || curl -s "${BASE_URL}/agents/${AGENT_ID}/addresses/${ADDRESS_ID}"
echo ""
echo ""

# Step 4: List all addresses with projection to see state relationship
echo "4. Listing all addresses for agent with state projection..."
echo "Request:"
echo "GET ${BASE_URL}/agents/${AGENT_ID}/addresses?include=address.state,address.country"
echo ""
echo "Response:"
curl -s "${BASE_URL}/agents/${AGENT_ID}/addresses?include=address.state,address.country" | python3 -m json.tool 2>/dev/null || curl -s "${BASE_URL}/agents/${AGENT_ID}/addresses?include=address.state,address.country"
echo ""
echo ""

# Step 5: Create international address (no state)
echo "5. Creating international address (Canada, no state)..."
echo "Request:"
echo "POST ${BASE_URL}/agents/${AGENT_ID}/addresses"
cat <<EOF
{
    "isPrimary": false,
    "type": "personal",
    "role": "contact",
    "line1": "456 Maple Avenue",
    "city": "Toronto",
    "postalCode": "M5V 3A8",
    "label": "Canada Office",
    "countryId": 2,
    "stateCode": null
}
EOF
echo ""
echo "Response:"
INTL_RESPONSE=$(curl -s -X POST "${BASE_URL}/agents/${AGENT_ID}/addresses" \
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
    }')
echo $INTL_RESPONSE | python3 -m json.tool 2>/dev/null || echo $INTL_RESPONSE
echo ""

# Step 6: Update address to change state
echo "6. Updating address to change from Texas to California..."
echo "Request:"
echo "PUT ${BASE_URL}/agents/${AGENT_ID}/addresses/${ADDRESS_ID}"
cat <<EOF
{
    "city": "San Francisco",
    "postalCode": "94102",
    "stateCode": "CA"
}
EOF
echo ""
echo "Response:"
UPDATE_RESPONSE=$(curl -s -X PUT "${BASE_URL}/agents/${AGENT_ID}/addresses/${ADDRESS_ID}" \
    -H "Content-Type: application/json" \
    -d '{
        "city": "San Francisco",
        "postalCode": "94102",
        "stateCode": "CA"
    }')
echo $UPDATE_RESPONSE | python3 -m json.tool 2>/dev/null || echo $UPDATE_RESPONSE
echo ""

# Step 7: Get primary address through agent endpoint
echo "7. Getting agent with primaryAddress included to test virtual state loading..."
echo "Request:"
echo "GET ${BASE_URL}/agents/${AGENT_ID}?include=primaryAddress"
echo ""
echo "Response (primaryAddress should have virtual state):"
curl -s "${BASE_URL}/agents/${AGENT_ID}?include=primaryAddress" | python3 -m json.tool 2>/dev/null || curl -s "${BASE_URL}/agents/${AGENT_ID}?include=primaryAddress"
echo ""

echo ""
echo "============================================"
echo "Test Complete!"
echo "============================================"
echo ""
echo "Key things to verify:"
echo "1. Address creation accepts countryId (number) instead of stateId (UUID)"
echo "2. Address creation accepts stateCode (2-letter string) for state reference"
echo "3. GET responses include virtual 'state' object populated via countryId + stateCode"
echo "4. International addresses work with stateCode = null"
echo "5. Updates properly handle stateCode changes"
echo "6. primaryAddress projection includes virtual state relationship"