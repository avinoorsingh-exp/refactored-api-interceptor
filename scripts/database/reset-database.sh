#!/usr/bin/env bash
#
# Reset Database Script
# Drops and recreates the agent_database, then runs migrations
#

# Load environment variables from .env file
if [ -f "../../.env" ]; then
  export $(grep -v '^#' ../../.env | xargs)
fi

# Use environment variables with fallback defaults
DATABASE_NAME=${DB_NAME}
USERNAME=${DB_USERNAME}
PASSWORD=${DB_PASSWORD}
HOST=${DB_HOST:-localhost}
PORT=${DB_PORT:-5432}

pwsh ./reset-database.ps1 -DatabaseName "$DATABASE_NAME" -Username "$USERNAME" -Password "$PASSWORD" -Host "$HOST" -Port "$PORT"
