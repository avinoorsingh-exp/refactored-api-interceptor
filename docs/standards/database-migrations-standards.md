# Database Migrations Standards

## Overview

This document defines the standards and procedures for database migrations in the Agent Service platform. It covers migration creation, naming conventions, local execution, and the automated Jenkins pipeline deployment process.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Migration Files](#migration-files)
3. [Naming Conventions](#naming-conventions)
4. [Creating Migrations](#creating-migrations)
5. [Running Migrations Locally](#running-migrations-locally)
6. [Jenkins Pipeline](#jenkins-pipeline)
7. [Environment Configuration](#environment-configuration)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   packages/database                         │
│                                                             │
│  src/                                                       │
│  ├── data-source.ts          # TypeORM DataSource config   │
│  ├── entities/               # Entity definitions          │
│  │   ├── core/               # Core domain entities        │
│  │   └── index.ts            # Entity exports              │
│  └── migrations/             # Migration files             │
│      ├── 1762356356157-InitialSchema.ts                    │
│      ├── 1763043601425-AddAuditFieldsToCountry.ts          │
│      └── ...                                               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     TypeORM CLI                             │
│   Commands: migration:run, migration:revert                │
│   Config: packages/database/src/data-source.ts             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                      │
│   Schema: core                                              │
│   Tables: migrations, country, region, company, ...        │
└─────────────────────────────────────────────────────────────┘
```

### Migration Table

TypeORM tracks executed migrations in a `migrations` table:

```sql
CREATE TABLE migrations (
  id SERIAL PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL
);
```

---

## Migration Files

### File Structure

Each migration file contains two methods:

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueConstraintToCompanyName1763138600000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Forward migration - apply changes
    await queryRunner.query(`
      ALTER TABLE core.company 
      ADD CONSTRAINT UQ_company_name UNIQUE (name)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse migration - undo changes
    await queryRunner.query(`
      ALTER TABLE core.company 
      DROP CONSTRAINT UQ_company_name
    `);
  }
}
```

### File Location

All migration files must be placed in:

```
packages/database/src/migrations/
```

---

## Naming Conventions

### File Naming

```
{timestamp}-{MigrationName}.ts
```

| Component | Format | Example |
|-----------|--------|---------|
| Timestamp | Unix timestamp (13 digits) | `1763138600000` |
| Migration Name | PascalCase, descriptive | `AddUniqueConstraintToCompanyName` |

### Class Naming

The class name should match the migration name with the timestamp appended:

```typescript
// File: 1763138600000-AddUniqueConstraintToCompanyName.ts
export class AddUniqueConstraintToCompanyName1763138600000
```

### Descriptive Names

Use clear, action-oriented names:

| Type | Pattern | Example |
|------|---------|---------|
| Create table | `Create{TableName}` | `CreateCompanyTable` |
| Add column | `Add{ColumnName}To{TableName}` | `AddEmailToCompany` |
| Remove column | `Remove{ColumnName}From{TableName}` | `RemovePhoneFromCompany` |
| Add constraint | `Add{ConstraintType}To{TableName}` | `AddUniqueConstraintToRegionName` |
| Add index | `Add{IndexName}IndexTo{TableName}` | `AddEmailIndexToCompany` |
| Modify column | `Alter{ColumnName}In{TableName}` | `AlterNameInCompany` |
| Seed data | `Seed{Description}` | `SeedInitialCountries` |
| Add audit fields | `AddAuditFieldsTo{TableName}` | `AddAuditFieldsToCountry` |

---

## Creating Migrations

### Method 1: Generate from Entity Changes (Recommended)

When you modify entity files, TypeORM can generate migrations automatically:

```bash
# From repository root
pnpm --filter @exprealty/database migration:generate src/migrations/AddEmailToCompany
```

**Note:** This requires a running database with existing schema to compare against.

### Method 2: Create Empty Migration

For custom SQL or data migrations:

```bash
# From repository root
pnpm --filter @exprealty/database migration:create src/migrations/SeedInitialData
```

### Method 3: Manual Creation

Create the file manually in `packages/database/src/migrations/`:

```typescript
// 1763138600000-AddUniqueConstraintToCompanyName.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueConstraintToCompanyName1763138600000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE core.company 
      ADD CONSTRAINT UQ_company_name UNIQUE (name)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE core.company 
      DROP CONSTRAINT UQ_company_name
    `);
  }
}
```

### Available npm Scripts

```json
{
  "scripts": {
    "migration:run": "typeorm-ts-node-commonjs migration:run -d src/data-source.ts",
    "migration:revert": "typeorm-ts-node-commonjs migration:revert -d src/data-source.ts",
    "migration:generate": "typeorm-ts-node-commonjs migration:generate -d src/data-source.ts",
    "migration:create": "typeorm-ts-node-commonjs migration:create"
  }
}
```

---

## Running Migrations Locally

### Prerequisites

1. Docker running with PostgreSQL container
2. Database created with correct schema

### Start Database

```bash
# Start PostgreSQL via Docker Compose
docker compose up -d postgres

# Or use the provided script
./scripts/create-database.sh
```

### Run Migrations

```bash
# From packages/database directory
cd packages/database
pnpm migration:run

# Or from repository root
pnpm --filter @exprealty/database migration:run
```

### Revert Last Migration

```bash
# From packages/database directory
cd packages/database
pnpm migration:revert
```

### Environment Variables

Set these for local development:

```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_USERNAME=postgres
export DB_PASSWORD=postgres
export DB_NAME=agent_service
```

Or use a `.env` file in `packages/database/`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=agent_service
```

---

## Jenkins Pipeline

### Pipeline Overview

The Jenkins pipeline runs migrations **before** deploying services to ensure database schema is up-to-date:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Build     │ → │  Run Mgr    │ → │   Deploy    │ → │    Test     │
│  Packages   │    │ (Dev)       │    │   (Dev)     │    │   (E2E)     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                          ↓
                   ┌─────────────┐    ┌─────────────┐
                   │  Run Mgr    │ → │   Deploy    │
                   │  (Test)     │    │   (Test)    │
                   └─────────────┘    └─────────────┘
                          ↓
                   ┌─────────────┐    ┌─────────────┐
                   │  Run Mgr    │ → │   Deploy    │
                   │  (QA/ACCP)  │    │   (QA/ACCP) │
                   └─────────────┘    └─────────────┘
                          ↓
                   ┌─────────────┐    ┌─────────────┐
                   │  Run Mgr    │ → │   Deploy    │
                   │  (Prod)     │    │   (Prod)    │
                   └─────────────┘    └─────────────┘
```

### Migration Stage Structure

Each environment has a dedicated migration stage:

```groovy
stage('Run Migrations - Development') {
  agent {
    docker {
      image 'node:20-alpine'
      args '-u root'
    }
  }
  when {
    anyOf {
      branch 'dev'
      branch 'test'
      branch 'main'
    }
  }
  steps {
    script {
      // 1. Install build dependencies
      sh 'apk add --no-cache jq python3 make g++ curl'
      
      // 2. Install pnpm
      sh 'npm install -g pnpm@10.5.2'
      
      // 3. Install project dependencies
      sh 'pnpm install'
      
      // 4. Build packages (required for TypeORM)
      sh 'pnpm build:packages'
      
      // 5. Fetch database credentials from AWS Secrets Manager
      def dbSecrets = sh(script: '''
        aws secretsmanager get-secret-value \
          --secret-id "dev/agent-service-dev" \
          --query "SecretString" \
          --output text
      ''', returnStdout: true).trim()
      
      def secrets = readJSON(text: dbSecrets)
      
      // 6. Download RDS CA certificate for SSL
      sh 'curl -o /tmp/rds-combined-ca-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem'
      
      // 7. Set environment variables and run migrations
      withEnv([
        "DB_HOST=${secrets.host}",
        "DB_PORT=${secrets.port}",
        "DB_USERNAME=${secrets.username}",
        "DB_PASSWORD=${secrets.password}",
        "DB_NAME=${secrets.dbname}",
        "DB_SSL=true",
        "DB_SSL_CA=/tmp/rds-combined-ca-bundle.pem"
      ]) {
        dir('packages/database') {
          sh 'pnpm migration:run'
        }
      }
    }
  }
}
```

### Environment Secrets

| Environment | AWS Secret Name | Branch |
|-------------|-----------------|--------|
| Development | `dev/agent-service-dev` | `dev`, `test`, `main` |
| Test | `dev/agent-service-test` | `test`, `main` |
| QA/Acceptance | `qa/agent-service-accp` | `main` |
| Production | `prod/agent-service-prod` | `main` |

### Secret Structure

AWS Secrets Manager secrets contain:

```json
{
  "host": "agent-service-dev.xxxxx.us-east-1.rds.amazonaws.com",
  "port": "5432",
  "username": "postgres",
  "password": "secure-password",
  "dbname": "agent_service"
}
```

---

## Environment Configuration

### DataSource Configuration

The `data-source.ts` file configures TypeORM:

```typescript
import { DataSource } from 'typeorm';
import * as entities from './entities/index.js';
import * as path from 'path';
import * as fs from 'fs';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432'),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'agent_service',
  
  // SSL Configuration for AWS RDS
  ssl: process.env.DB_SSL === 'true'
    ? {
        rejectUnauthorized: true,
        ca: process.env.DB_SSL_CA
          ? fs.readFileSync(process.env.DB_SSL_CA).toString()
          : undefined,
      }
    : undefined,
  
  // Entity and migration paths
  entities: Object.values(entities),
  migrations: [path.join(__dirname, 'migrations', '*.{ts,js}')],
  
  // Schema settings
  synchronize: false,  // NEVER true in production
  logging: process.env.DB_LOGGING === 'true',
});
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USERNAME` | Database username | `postgres` |
| `DB_PASSWORD` | Database password | `postgres` |
| `DB_NAME` | Database name | `agent_service` |
| `DB_SSL` | Enable SSL (`true`/`false`) | `false` |
| `DB_SSL_CA` | Path to CA certificate | - |
| `DB_LOGGING` | Enable query logging | `false` |

---

## Best Practices

### DO

- ✅ **Always write reversible migrations** - Every `up()` should have a corresponding `down()`
- ✅ **Test migrations locally** before pushing
- ✅ **Use transactions** for multi-statement migrations (TypeORM does this by default)
- ✅ **Add constraints and indexes** as separate migrations for clarity
- ✅ **Use `IF EXISTS`/`IF NOT EXISTS`** when appropriate for idempotency
- ✅ **Document breaking changes** in migration comments
- ✅ **Keep migrations small** and focused on one change

### DON'T

- ❌ **Never modify existing migration files** after they've been run in any environment
- ❌ **Never use `synchronize: true`** in production
- ❌ **Don't delete migration files** - they are part of schema history
- ❌ **Don't include sensitive data** (credentials, PII) in migrations
- ❌ **Avoid data migrations in DDL migrations** - separate schema changes from data changes
- ❌ **Don't assume empty tables** - always handle existing data

### Migration Safety Checklist

Before merging a migration:

- [ ] Does `up()` have a matching `down()`?
- [ ] Tested locally with `migration:run` and `migration:revert`?
- [ ] No syntax errors in SQL?
- [ ] Schema name (`core.`) included in table references?
- [ ] Constraint names are unique and descriptive?
- [ ] Large table alterations consider locking implications?
- [ ] Data migration handles NULL values appropriately?

### Data Migration Pattern

For data migrations, separate from DDL:

```typescript
// 1763138700000-SeedInitialCountries.ts
export class SeedInitialCountries1763138700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Use INSERT ... ON CONFLICT for idempotency
    await queryRunner.query(`
      INSERT INTO core.country (name, alpha_2, alpha_3, number)
      VALUES 
        ('United States', 'US', 'USA', 840),
        ('Canada', 'CA', 'CAN', 124)
      ON CONFLICT (alpha_2) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM core.country 
      WHERE alpha_2 IN ('US', 'CA')
    `);
  }
}
```

---

## Troubleshooting

### Common Issues

#### 1. Migration Already Run

```
Error: Migration "AddSomething1234567890" has already been run
```

**Cause:** Migration entry exists in `migrations` table.

**Solution:** 
- If intentional, migration is already applied
- If testing locally, reset database or manually delete from `migrations` table

#### 2. Cannot Find Module

```
Error: Cannot find module './migrations/1234567890-SomeMigration'
```

**Cause:** Migration file not compiled or path incorrect.

**Solution:**
```bash
# Rebuild packages
pnpm build:packages

# Verify file exists
ls packages/database/src/migrations/
```

#### 3. SSL Connection Error

```
Error: self signed certificate in certificate chain
```

**Cause:** Missing or incorrect SSL CA certificate.

**Solution:**
```bash
# Download RDS CA bundle
curl -o /tmp/rds-combined-ca-bundle.pem \
  https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem

# Set environment variable
export DB_SSL_CA=/tmp/rds-combined-ca-bundle.pem
```

#### 4. Permission Denied

```
Error: permission denied for schema core
```

**Cause:** Database user lacks schema permissions.

**Solution:** Grant permissions:
```sql
GRANT ALL ON SCHEMA core TO your_user;
GRANT ALL ON ALL TABLES IN SCHEMA core TO your_user;
```

#### 5. Migration Fails Mid-Way

If a migration fails partway through:

1. Check what was applied:
   ```sql
   SELECT * FROM migrations ORDER BY id DESC LIMIT 5;
   ```

2. Manually fix the issue or run the failed statements

3. If needed, manually insert migration record:
   ```sql
   INSERT INTO migrations (timestamp, name) 
   VALUES (1763138600000, 'AddUniqueConstraintToCompanyName1763138600000');
   ```

### Debugging Commands

```bash
# Show migration status
pnpm --filter @exprealty/database migration:show

# Generate SQL without executing
pnpm --filter @exprealty/database migration:generate --dry-run

# Verbose logging
DB_LOGGING=true pnpm --filter @exprealty/database migration:run
```

---

## Current Migrations

Migrations live in `packages/database/src/migrations/` and are auto-discovered by timestamp
prefix. To see the full list:

```bash
ls packages/database/src/migrations/
```

To check which migrations have run against a database:

```bash
pnpm --filter @exprealty/database migration:show
```

---

## Related Documentation

- [Pagination and Query Standards](./PAGINATION-AND-QUERY-STANDARDS.md)
- [Architecture Overview](../ARCHITECTURE-OVERVIEW.md)
- [Database Entity Separation ADR](../ADRs/001-database-entity-separation.md)
