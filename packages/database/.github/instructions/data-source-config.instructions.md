```instructions
---
applyTo: "**/data-source.ts, **/*.module.ts"
---

# Data Source Configuration Instructions

You are an expert in TypeORM data source configuration for the @exprealty/database package. This instruction covers critical configuration settings that prevent data loss and ensure proper schema management.

## The Golden Rule: Never Use Synchronize

**`synchronize: true` MUST NEVER be used in any environment, including development.**

```typescript
// CORRECT ✅
synchronize: false,  // ALWAYS false - use migrations

// INCORRECT ❌
synchronize: cfg.NODE_ENV === 'dev',  // DO NOT DO THIS
synchronize: true,  // NEVER
```

### Why Synchronize is Dangerous

1. **Data Loss**: TypeORM may drop columns or tables to match entity definitions
2. **Constraint Conflicts**: Cannot modify columns with dependent foreign keys
3. **Unpredictable Behavior**: Schema changes happen automatically on startup
4. **Race Conditions**: Multiple instances can conflict during schema sync
5. **No Rollback**: Changes cannot be undone without backup restoration
6. **Production Risk**: Developers may forget to disable before deployment

### The Actual Error

When `synchronize: true` encounters foreign key dependencies:

```
QueryFailedError: cannot drop constraint UQ_agent_agent_id on table core.agent 
because other objects depend on it
```

This happens because:
1. Entity change triggers automatic schema update
2. TypeORM tries to modify a column
3. Foreign key from another table prevents the change
4. Application fails to start

## Proper Schema Management

### Use Migrations Only

```typescript
// data-source.ts
export const AppDataSource = new DataSource({
  type: 'postgres',
  // ... connection settings
  
  synchronize: false,  // NEVER true
  
  // Migrations are loaded via glob pattern
  migrations: ['./src/migrations/*.ts'],
  
  // Or explicitly list migrations for production builds
  // migrations: [Migration1, Migration2, Migration3],
});
```

### Development Workflow

1. **Modify entity** files as needed
2. **Generate migration**: `pnpm migration:generate -- -n DescriptiveName`
3. **Review migration**: Ensure it's idempotent and has proper rollback
4. **Run migration**: `pnpm migration:run`
5. **Test rollback**: `pnpm migration:revert`

### Commands

```bash
# Generate a new migration from entity changes
pnpm migration:generate -- -n AddNewColumn

# Run pending migrations
pnpm migration:run

# Revert last migration
pnpm migration:revert

# Show migration status
pnpm migration:show

# Fresh database (reset + run all migrations)
pnpm db:fresh
```

## Connection Configuration

### Required Settings

```typescript
{
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  
  // Schema settings
  schema: 'core',  // Default schema for entities
  synchronize: false,  // ALWAYS false
  
  // Logging
  logging: process.env.NODE_ENV === 'production' 
    ? ['error'] 
    : ['error', 'warn', 'schema', 'query'],
  
  // Connection pool
  extra: {
    max: 20,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  },
}
```

### SSL Configuration for AWS RDS

```typescript
ssl: {
  rejectUnauthorized: false,
  checkServerIdentity: () => undefined,
  minVersion: 'TLSv1.2',
  // Optionally load RDS CA certificate
  // ca: fs.readFileSync('./rds-ca-cert.pem'),
},
```

## Entity Loading

### With NestJS (autoLoadEntities)

```typescript
// database.module.ts
TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    type: 'postgres',
    // ...
    autoLoadEntities: true,  // Loads entities from forFeature()
    synchronize: false,
  }),
}),
```

### Without NestJS (explicit entities)

```typescript
// data-source.ts
import { AgentEntity, OfficeEntity, ... } from './entities';

export const AppDataSource = new DataSource({
  // ...
  entities: [AgentEntity, OfficeEntity, /* all entities */],
  synchronize: false,
});
```

## Critical Rules

1. **NEVER set synchronize to true** - Not even conditionally for dev
2. **ALWAYS use migrations** for schema changes
3. **REVIEW auto-generated migrations** before running
4. **TEST migrations** on production-sized data
5. **IMPLEMENT rollback** for every migration
6. **BACKUP database** before running migrations in production
7. **USE connection pooling** for production deployments
8. **CONFIGURE SSL** for cloud database connections
9. **LOG errors** in all environments, queries only in dev
10. **SET proper timeouts** for connection and idle

## Debugging Connection Issues

### Check Migration Status
```bash
pnpm typeorm -- migration:show
```

### View Pending Migrations
```bash
pnpm typeorm -- migration:show --pending
```

### Test Connection
```typescript
// In a script or test
const dataSource = new DataSource({...});
await dataSource.initialize();
console.log('Connected:', dataSource.isInitialized);
await dataSource.destroy();
```
```
