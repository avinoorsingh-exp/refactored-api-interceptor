#!/usr/bin/env bash
#
# Create Database Script
# Creates the agent_database if it doesn't already exist
#
# Usage: ./scripts/create-database.sh
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
echo -e "${YELLOW}Create Database Script${NC}"
echo -e "${YELLOW}==================================================${NC}"
echo ""
echo -e "Database: ${GREEN}${DB_NAME}${NC}"
echo -e "Host: ${GREEN}${DB_HOST}:${DB_PORT}${NC}"
echo -e "User: ${GREEN}${DB_USER}${NC}"
echo ""

# Check if database exists and create if needed
echo -e "${YELLOW}Checking if database exists...${NC}"

# Check if running via Docker or local psql
if command -v psql &> /dev/null; then
  # Local psql available
  export PGPASSWORD="${DB_PASSWORD}"
  
  # Check if database exists
  DB_EXISTS=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")
  
  if [ "$DB_EXISTS" = "1" ]; then
    echo -e "${GREEN}✓ Database '${DB_NAME}' already exists${NC}"
  else
    echo -e "${YELLOW}Creating database '${DB_NAME}'...${NC}"
    psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c "CREATE DATABASE ${DB_NAME};"
    echo -e "${GREEN}✓ Database '${DB_NAME}' created successfully${NC}"
  fi
else
  # Use Docker
  echo "Using Docker to access PostgreSQL..."
  
  # Check if database exists
  DB_EXISTS=$(docker-compose exec -T postgres psql -U "${DB_USER}" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")
  
  if [ "$DB_EXISTS" = "1" ]; then
    echo -e "${GREEN}✓ Database '${DB_NAME}' already exists${NC}"
  else
    echo -e "${YELLOW}Creating database '${DB_NAME}'...${NC}"
    docker-compose exec -T postgres psql -U "${DB_USER}" -d postgres -c "CREATE DATABASE ${DB_NAME};"
    echo -e "${GREEN}✓ Database '${DB_NAME}' created successfully${NC}"
  fi
fi

echo ""
echo -e "${GREEN}==================================================${NC}"
echo -e "${GREEN}Database Setup Complete${NC}"
echo -e "${GREEN}==================================================${NC}"
echo ""
echo -e "Next steps:"
echo -e "  1. Run migrations:"
echo -e "     ${GREEN}cd packages/database && pnpm run migration:run${NC}"
echo -e "  2. Or generate a new migration:"
echo -e "     ${GREEN}cd packages/database && pnpm run migration:generate ./src/migrations/MigrationName${NC}"
echo ""
