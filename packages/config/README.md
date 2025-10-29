# @exprealty/config

Centralized configuration management for exprealty services using environment variables, `.env` files, and Zod schema validation.

## Overview

This package provides a standardized way to load and validate configuration across all services in the monorepo. It handles:

- ✅ Loading `.env` files from multiple locations with proper precedence
- ✅ Schema validation using Zod with type inference
- ✅ In-memory caching to avoid re-parsing
- ✅ Variable expansion (e.g., `API_URL=${HOST}:${PORT}`)
- ✅ Automatic repo root detection
- ✅ Secret redaction utilities

## Installation

```bash
pnpm add @exprealty/config
```

## How Configuration Files Are Loaded

The `loadConfig()` function follows a **cascading configuration** pattern with the following precedence (highest to lowest):

### Loading Order

1. **Existing `process.env` variables** (highest precedence)
   - Variables already set in the environment are never overwritten
   - This allows container orchestrators (Docker, Kubernetes) to inject config

2. **Repository root `.env`** files
   - `{repoRoot}/.env` - Base configuration for all services
   - `{repoRoot}/.env.local` - Local overrides (gitignored)

3. **Service directory `.env`** files
   - `{serviceDir}/.env` - Service-specific configuration
   - `{serviceDir}/.env.local` - Service-specific local overrides

4. **Extra environment file** (optional)
   - `{repoRoot}/.env.{serviceName}` - Named service config (e.g., `.env.orchestrator`)

5. **Schema defaults**
   - Zod schema `.default()` values are used if variable not found anywhere

### File Loading Behavior

- **Non-existent files are skipped silently** - no errors thrown
- **Earlier files win** - dotenv doesn't overwrite existing variables
- **Memory-only fallback** - if no `.env` files exist, config is read entirely from:
  - Existing `process.env` variables
  - Schema default values
  - This makes the config system work in production without any `.env` files

### Example: Full Loading Sequence

For `services/orchestrator`:

```
1. Check process.env (container/system vars)          ← Highest precedence
2. Load /repo/.env (if exists)
3. Load /repo/.env.local (if exists)
4. Load /repo/services/orchestrator/.env (if exists)
5. Load /repo/services/orchestrator/.env.local (if exists)
6. Load /repo/.env.orchestrator (if extraEnvFile specified)
7. Apply schema defaults for missing values           ← Lowest precedence
```

## Usage

### Basic Usage

```typescript
import { loadConfig, BaseConfig } from '@exprealty/config'
import { z } from 'zod'

// Define your service schema (extends BaseConfig)
const MyServiceSchema = BaseConfig.extend({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  API_KEY: z.string(),
})

type MyServiceConfig = z.infer<typeof MyServiceSchema>

// Load and validate configuration
const config = loadConfig(MyServiceSchema, {
  extraEnvFile: '.env.myservice', // Optional
})

console.log(config.PORT) // Type-safe access
```

### NestJS Integration

```typescript
// services/orchestrator/src/core/configuration.ts
import { z } from 'zod'
import { BaseConfig, loadConfig } from '@exprealty/config'

export const ConfigSchema = BaseConfig.extend({
  PORT: z.coerce.number().default(8081),
  AGENT_SERVICE_URL: z.string().default('http://localhost:3000'),
  AGENT_SERVICE_TRANSPORT: z.enum(['rest', 'grpc']).default('rest'),
})

export type Config = z.infer<typeof ConfigSchema>

export default () => {
  try {
    const config = loadConfig(ConfigSchema, {
      extraEnvFile: '.env.orchestrator',
    })
    return config
  } catch (error) {
    console.error('[configuration()] FAILED to load config:', error)
    throw error
  }
}
```

```typescript
// app.module.ts
import { Module } from '@nestjs/common'
import { ConfigModule as NestConfigModule } from '@nestjs/config'
import configuration from './core/configuration.js'

@Module({
  imports: [
    NestConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
    }),
  ],
})
export class AppModule {}
```

### Custom Service Directory

```typescript
const config = loadConfig(MyServiceSchema, {
  serviceDir: '/path/to/service',  // Defaults to process.cwd()
  repoRoot: '/path/to/repo',       // Auto-detected if not provided
  extraEnvFile: '.env.custom',     // Relative to repoRoot
})
```

## API Reference

### `loadConfig<TOutput>(schema, options?): TOutput`

Loads environment variables, validates against schema, and returns typed config.

**Parameters:**
- `schema: z.ZodType<TOutput>` - Zod schema for validation
- `options?: EnvLoadOptions` - Loading options

**Returns:** Typed configuration object

**Features:**
- ✅ Cached by schema instance (subsequent calls return cached result)
- ✅ Throws `ZodError` if validation fails
- ✅ Type-safe return value inferred from schema

### `loadEnv(options?): void`

Loads `.env` files into `process.env` without validation.

**Parameters:**
- `options?: EnvLoadOptions`
  - `extraEnvFile?: string` - Path to additional env file
  - `serviceDir?: string` - Service directory (defaults to `process.cwd()`)
  - `repoRoot?: string` - Repository root (auto-detected)

### `BaseConfig`

Base Zod schema with common configuration:

```typescript
const BaseConfig = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.string().default('info'),
  LOG_DIR: z.string().default('./logs'),
})
```

Extend this for service-specific config:

```typescript
const MyConfig = BaseConfig.extend({
  PORT: z.coerce.number().default(3000),
})
```

### `redact<T>(obj, keys?): T`

Utility to redact secrets when logging configuration.

```typescript
import { redact } from '@exprealty/config'

const config = { API_KEY: 'secret', PORT: 3000 }
console.log(redact(config))
// { API_KEY: '***redacted***', PORT: 3000 }
```

**Auto-detection:** Redacts keys containing: `SECRET`, `TOKEN`, `PASSWORD`, `KEY`

## In-Memory Configuration

**Important:** If no `.env` files exist, the config system still works by:

1. Reading existing `process.env` variables (set by container/system)
2. Applying schema defaults for missing values
3. Caching the result in memory (via `WeakMap`)

This design allows services to run in:
- **Development:** Load from `.env` files
- **Production:** Use environment variables from Docker/Kubernetes
- **CI/CD:** Mix of both or entirely from environment

## Caching Behavior

Configuration is cached by schema instance using a `WeakMap`:

```typescript
// First call - loads files and validates
const config1 = loadConfig(MySchema)

// Second call - returns cached result (no file I/O or validation)
const config2 = loadConfig(MySchema)

// Same reference
console.log(config1 === config2) // true
```

**Cache invalidation:** Not supported. Restart the service to reload configuration.

## Variable Expansion

Supports dotenv-expand syntax:

```bash
# .env
HOST=localhost
PORT=3000
API_URL=http://${HOST}:${PORT}
```

```typescript
const config = loadConfig(MySchema)
console.log(config.API_URL) // "http://localhost:3000"
```

## Error Handling

### Validation Errors

```typescript
import { z } from 'zod'

try {
  const config = loadConfig(MySchema)
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('Configuration validation failed:')
    error.errors.forEach(err => {
      console.error(`  ${err.path.join('.')}: ${err.message}`)
    })
  }
}
```

### Missing Required Variables

```typescript
const Schema = z.object({
  REQUIRED_VAR: z.string(), // No .default() = required
})

// Throws ZodError if REQUIRED_VAR not set
const config = loadConfig(Schema)
```

## Best Practices

### 1. One Schema Per Service

```typescript
// ❌ Don't share schemas between services
// ✅ Each service defines its own schema

// services/orchestrator/src/core/configuration.ts
export const OrchestratorSchema = BaseConfig.extend({ ... })

// services/agent-service/src/core/configuration.ts
export const AgentServiceSchema = BaseConfig.extend({ ... })
```

### 2. Use Type Inference

```typescript
// ✅ Let TypeScript infer the type
export type Config = z.infer<typeof ConfigSchema>

// ❌ Don't manually define config types
type Config = { PORT: number, ... }
```

### 3. Provide Sensible Defaults

```typescript
// ✅ Defaults for development
const Schema = BaseConfig.extend({
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.string().default('info'),
})

// ⚠️ No default = required in production
const Schema = BaseConfig.extend({
  DATABASE_URL: z.string().url(), // Must be set
})
```

### 4. Use `.coerce` for Numbers/Booleans

```typescript
// ✅ Coerce string env vars to numbers
PORT: z.coerce.number().default(3000)

// ✅ Coerce string env vars to booleans
ENABLE_FEATURE: z.coerce.boolean().default(false)

// ❌ Don't use z.number() directly (env vars are always strings)
PORT: z.number() // Will fail validation
```

### 5. Redact Secrets in Logs

```typescript
import { redact } from '@exprealty/config'

const config = loadConfig(MySchema)

// ✅ Redact before logging
logger.info('Configuration loaded', redact(config))

// ❌ Don't log raw config
logger.info('Configuration loaded', config) // Leaks secrets
```

## Repository Detection

The library automatically detects the repository root by walking up from `serviceDir`:

```typescript
function detectRepoRoot(startDir: string) {
  // Walks up to 6 levels looking for:
  // - .git directory
  // - pnpm-workspace.yaml
  return repoRootPath
}
```

Override if auto-detection fails:

```typescript
const config = loadConfig(MySchema, {
  repoRoot: '/absolute/path/to/repo',
})
```

## Development vs Production

### Development Setup

```bash
# repo/.env (base config for all services)
NODE_ENV=development
LOG_LEVEL=debug

# repo/.env.local (gitignored personal overrides)
DATABASE_URL=postgresql://localhost:5432/mydb

# repo/services/orchestrator/.env.orchestrator
PORT=8081
AGENT_SERVICE_URL=http://localhost:3000
```

### Production Deployment

```yaml
# docker-compose.yml or Kubernetes manifest
environment:
  NODE_ENV: production
  LOG_LEVEL: info
  DATABASE_URL: postgresql://prod-db:5432/app
  PORT: 8081
  AGENT_SERVICE_URL: http://agent-service:3000
```

No `.env` files needed - config loaded entirely from environment variables and schema defaults.

## Testing

```typescript
import { loadConfig } from '@exprealty/config'
import { z } from 'zod'

describe('Config', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should load config from environment', () => {
    process.env.PORT = '4000'
    process.env.DATABASE_URL = 'postgresql://test:5432/db'

    const config = loadConfig(MySchema)

    expect(config.PORT).toBe(4000)
    expect(config.DATABASE_URL).toBe('postgresql://test:5432/db')
  })
})
```

## FAQ

**Q: What happens if no `.env` files exist?**  
A: Config is loaded entirely from `process.env` (set by container/system) and schema defaults. No errors thrown.

**Q: Can I reload config at runtime?**  
A: No. Config is cached by schema instance. Restart the service to reload.

**Q: Why doesn't `.env.local` override `.env`?**  
A: dotenv never overwrites existing variables. The first file to set a variable wins. Files are loaded in order, so earlier variables persist.

**Q: How do I debug which files are being loaded?**  
A: Set `DEBUG=dotenv:*` environment variable before starting your service.

**Q: Can I use this outside NestJS?**  
A: Yes! It's framework-agnostic. Works with Express, Fastify, or standalone Node.js apps.

## License

UNLICENSED - Internal use only.

## Contributing

This package is part of the exprealty monorepo. See the main repository README for contribution guidelines.
