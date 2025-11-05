#!/usr/bin/env bash
#
# Create Database Script
# Creates the agent_database if it doesn't already exist
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

pwsh ./create-database.ps1 -DatabaseName "$DATABASE_NAME" -Username "$USERNAME" -Password "$PASSWORD" -Host "$HOST" -Port "$PORT"