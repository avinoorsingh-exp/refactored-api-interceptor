#!/bin/bash

# Quick test for state-to-country migration
# Usage: ./quick-test.sh [AGENT_ID]

BASE_URL="http://localhost:3000/v1"

# Use provided agent ID or fetch first one
if [ -n "$1" ]; then
    AGENT_ID=$1
    echo "Using provided Agent ID: $AGENT_ID"
else
    echo "Fetching first agent..."
    AGENT_ID=$(curl -s "${BASE_URL}/agents?limit=1" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

    if [ -z "$AGENT_ID" ]; then
        echo "No agents found. Please create an agent first or provide an ID."
        exit 1
    fi
    echo "Using Agent ID: $AGENT_ID"
fi

echo ""
echo "Creating address with countryId=1, stateCode='TX'..."
RESPONSE=$(curl -s -X POST "${BASE_URL}/agents/${AGENT_ID}/addresses" \
    -H "Content-Type: application/json" \
    -d '{
        "isPrimary": true,
        "line1": "123 Quick Test St",
        "city": "Austin",
        "postalCode": "78701",
        "countryId": 1,
        "stateCode": "TX"
    }')

echo "Response:"
echo $RESPONSE | python3 -m json.tool 2>/dev/null || echo $RESPONSE

# Extract address ID
ADDRESS_ID=$(echo $RESPONSE | grep -o '"addressId":"[^"]*"' | cut -d'"' -f4)

if [ -n "$ADDRESS_ID" ]; then
    echo ""
    echo "Success! Created address ID: $ADDRESS_ID"
    echo ""
    echo "Fetching address to verify virtual state..."
    curl -s "${BASE_URL}/agents/${AGENT_ID}/addresses/${ADDRESS_ID}" | python3 -m json.tool 2>/dev/null
else
    echo ""
    echo "Failed to create address. Check the response above for errors."
fi