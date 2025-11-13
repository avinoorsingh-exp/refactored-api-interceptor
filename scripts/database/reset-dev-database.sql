-- =====================================================
-- Reset Development Database Script
-- =====================================================
-- This script will drop the entire 'core' schema and all its tables,
-- then you can run migrations from scratch.
--
-- DANGER: This will DELETE ALL DATA in the core schema!
-- Only use this in development environments.
--
-- Usage in DBeaver:
-- 1. Connect to: localhost:5433 -> agent_database
-- 2. Open this script
-- 3. Execute (Ctrl+Enter or click Execute SQL Statement)
-- =====================================================

-- Drop the core schema CASCADE (removes all tables, views, functions, etc.)
DROP SCHEMA IF EXISTS core CASCADE;

-- Drop the typeorm_migrations table (TypeORM tracking)
DROP TABLE IF EXISTS typeorm_migrations CASCADE;

-- Optionally drop the uuid extension if you want to recreate it
-- DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;

-- Verify schemas remaining
SELECT schemaname 
FROM pg_catalog.pg_namespace 
WHERE schemaname NOT LIKE 'pg_%' 
AND schemaname != 'information_schema' 
ORDER BY schemaname;

-- Show that core schema is gone
SELECT 'Database reset complete - core schema dropped' AS status;
SELECT 'Run: pnpm migration:run to recreate schema and tables' AS next_step;
