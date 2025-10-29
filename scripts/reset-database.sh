#!/usr/bin/env bash
#
# Reset Database Script
# Drops and recreates the agent_database, then removes all migration files
#
# Usage: ./scripts/reset-database.sh
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Database configuration (matches docker-compose.yml)
DB_NAME="${DB_NAME:-agent_database}"
DB_USER="${DB_USERNAME:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

echo -e "${YELLOW}==================================================${NC}"
echo -e "${YELLOW}Database Reset Script${NC}"
echo -e "${YELLOW}==================================================${NC}"
echo ""
echo -e "Database: ${GREEN}${DB_NAME}${NC}"
echo -e "Host: ${GREEN}${DB_HOST}:${DB_PORT}${NC}"
echo -e "User: ${GREEN}${DB_USER}${NC}"
echo ""

# Step 1: Drop and recreate database
echo -e "${YELLOW}[1/3]${NC} Dropping and recreating database..."

# Check if running via Docker or local psql
if command -v psql &> /dev/null; then
  # Local psql available
  export PGPASSWORD="${DB_PASSWORD}"
  psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};" 2>/dev/null || true
  psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c "CREATE DATABASE ${DB_NAME};"
else
  # Use Docker
  echo "Using Docker to access PostgreSQL..."
  docker-compose exec -T postgres psql -U "${DB_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};" 2>/dev/null || true
  docker-compose exec -T postgres psql -U "${DB_USER}" -d postgres -c "CREATE DATABASE ${DB_NAME};"
fi

echo -e "${GREEN}✓ Database recreated${NC}"
echo ""

# Step 2: Remove old migration files
echo -e "${YELLOW}[2/3]${NC} Removing old migration files..."

MIGRATION_DIR="./packages/database/src/migrations"

if [ -d "${MIGRATION_DIR}" ]; then
  # Count files before deletion
  FILE_COUNT=$(find "${MIGRATION_DIR}" -type f -name "*.ts" ! -name ".gitkeep" | wc -l)
  
  if [ "$FILE_COUNT" -gt 0 ]; then
    find "${MIGRATION_DIR}" -type f -name "*.ts" ! -name ".gitkeep" -delete
    echo -e "${GREEN}✓ Removed ${FILE_COUNT} migration file(s)${NC}"
  else
    echo -e "${GREEN}✓ No migration files to remove${NC}"
  fi
else
  echo -e "${RED}✗ Migration directory not found: ${MIGRATION_DIR}${NC}"
  exit 1
fi

# Also clean dist folder
if [ -d "./packages/database/dist/migrations" ]; then
  rm -rf ./packages/database/dist/migrations/*
  echo -e "${GREEN}✓ Cleaned dist/migrations folder${NC}"
fi

echo ""

# Step 3: Summary
echo -e "${YELLOW}[3/3]${NC} Summary:"
echo -e "${GREEN}✓ Database '${DB_NAME}' is now empty and ready${NC}"
echo -e "${GREEN}✓ All migration files removed${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Update your TypeORM entities in packages/database/src/entities/"
echo -e "  2. Generate new migration:"
echo -e "     ${GREEN}cd packages/database && pnpm run migration:generate ./src/migrations/InitialSchema${NC}"
echo -e "  3. Run the migration:"
echo -e "     ${GREEN}pnpm run migration:run${NC}"
echo ""
echo -e "Or use the combined command:"
echo -e "  ${GREEN}cd packages/database && pnpm run db:fresh${NC}"
echo ""
echo -e "${GREEN}==================================================${NC}"
echo -e "${GREEN}Database reset complete!${NC}"
echo -e "${GREEN}==================================================${NC}"
