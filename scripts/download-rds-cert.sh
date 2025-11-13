#!/bin/bash
# =====================================================
# Download AWS RDS Global Bundle Certificate
# =====================================================
# This script downloads the AWS RDS CA certificate bundle
# required for SSL connections to RDS databases.
#
# The certificate will be placed in the repository root
# so it can be copied into Docker images.
# =====================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CERT_FILE="$REPO_ROOT/global-bundle.pem"

echo "📥 Downloading AWS RDS CA Certificate Bundle..."
echo "Target: $CERT_FILE"

# Try global bundle first (recommended)
if curl -f -o "$CERT_FILE" https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem; then
    echo "✅ Successfully downloaded global-bundle.pem"
    chmod 644 "$CERT_FILE"
    
    # Show certificate info
    echo ""
    echo "📋 Certificate Bundle Info:"
    openssl crl2pkcs7 -nocrl -certfile "$CERT_FILE" | openssl pkcs7 -print_certs -noout | grep -E "subject=|issuer=" | head -10
    
    echo ""
    echo "✅ Certificate ready for Docker builds"
    echo "Location: $CERT_FILE"
else
    echo "❌ Failed to download global bundle, trying regional bundle..."
    
    # Fallback to regional bundle
    if curl -f -o "$CERT_FILE" https://truststore.pki.rds.amazonaws.com/us-east-1/us-east-1-bundle.pem; then
        echo "✅ Successfully downloaded us-east-1-bundle.pem"
        chmod 644 "$CERT_FILE"
        echo "Location: $CERT_FILE"
    else
        echo "❌ Failed to download RDS certificate bundle"
        exit 1
    fi
fi
