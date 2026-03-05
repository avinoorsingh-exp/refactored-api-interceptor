# Shared-Domain Entity Implementation Guide

## Overview

This guide documents the **Zod-First Architecture** pattern for implementing new entities across the monorepo. This ensures consistency, eliminates duplicate validation logic, and maintains a single source of truth.

## Architecture Principles

1. **Single Source of Truth**: Validation rules defined once in `@exprealty/shared-domain`
2. **Type Safety**: TypeScript types derived from Zod schemas
3. **Separation of Concerns**: 
   - Shared-domain: Validation schemas and types
   - Database: TypeORM entities for persistence
   - Services: DTOs for HTTP layer documentation (Swagger)
4. **No Duplication**: No class-validator decorators in service DTOs

---

## Step-by-Step Implementation

### Step 1: Define Shared-Domain Schema

**File**: `/packages/shared-domain/src/entities/{entity-name}.ts`

```typescript
import { z } from 'zod'

/**
 * Base schema for {Entity} entity.
 * @public
 */
export const {Entity}BaseSchema = z
  .object({
    {entity}Id: z.number().int().positive(),
    name: z.string().min(1).max(255),
    // Add all fields with Zod validation
  })
  .describe('Base {Entity}')

/**
 * @public
 */
export type {Entity}Base = z.infer<typeof {Entity}BaseSchema>

/**
 * Expanded schema with relationships (if needed)
 * @public
 */
export const {Entity}ExpandedSchema = {Entity}BaseSchema.extend({
  // Add relationship fields here if needed
})

/**
 * @public
 */
export type {Entity}Expanded = z.infer<typeof {Entity}ExpandedSchema>

/**
 * @public
 */
export type {Entity} = {Entity}Expanded

/**
 * Schema for creating a new {Entity}.
 * Omits auto-generated fields and makes optional fields explicit.
 * @public
 */
export const Create{Entity}InputSchema = {Entity}BaseSchema.omit({ 
  {entity}Id: true 
}).extend({
  // Override fields to make them optional if needed
  // optionalField: z.string().optional(),
})

/**
 * @public
 */
export type Create{Entity}Input = z.infer<typeof Create{Entity}InputSchema>

/**
 * Schema for updating a {Entity}.
 * @public
 */
export const Update{Entity}InputSchema = {Entity}BaseSchema.omit({
  {entity}Id: true,
}).partial()

/**
 * @public
 */
export type Update{Entity}Input = z.infer<typeof Update{Entity}InputSchema>
```

**Export in `/packages/shared-domain/src/index.ts`**:
```typescript
export * from './entities/{entity-name}.js'
```

**Rebuild shared-domain**:
```bash
pnpm --filter @exprealty/shared-domain build
```

---

### Step 2: Create TypeORM Entity

**File**: `/packages/database/src/entities/{entity-name}.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'

/**
 * TypeORM entity for {Entity} table.
 * @public
 */
@Entity('{entities}') // plural table name
export class {Entity}Entity {
  @PrimaryGeneratedColumn('increment', { 
    type: 'integer', 
    name: '{entity}_id' 
  })
  {entity}Id!: number

  @Column({ type: 'text' })
  name!: string

  // Map all fields with appropriate TypeORM decorators
  // Match column names to database schema (snake_case)
  
  // Example: unique constraint
  @Column({ name: 'code', type: 'varchar', length: 10, unique: true })
  code!: string
}
```

**Export in `/packages/database/src/index.ts`**:
```typescript
export * from './entities/{entity-name}.entity.js'
```

---

### Step 3: Create Service DTOs

#### Create DTO (Request)

**File**: `/services/{service}/src/modules/{entities}/dto/create-{entity}.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger'
import type { Create{Entity}Input } from '@exprealty/shared-domain'

/**
 * DTO for creating a new {Entity}.
 * Implements shared-domain Create{Entity}Input type.
 * Validation is handled by ZodValidationPipe using Create{Entity}InputSchema.
 * This class exists primarily for Swagger API documentation.
 */
export class Create{Entity}Dto implements Create{Entity}Input {
  /**
   * Field description
   * @example "Example value"
   */
  @ApiProperty({
    description: 'Field description',
    example: 'Example value',
    // Add other Swagger metadata: minLength, maxLength, pattern, etc.
  })
  name!: string

  // Add all fields from Create{Entity}Input
  // Only use @ApiProperty for Swagger documentation
  // NO class-validator decorators (@IsString, @IsInt, etc.)
}
```

#### Response DTO

**File**: `/services/{service}/src/modules/{entities}/dto/{entity}-response.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger'
import type { {Entity} } from '@exprealty/shared-domain'

/**
 * Response DTO for {Entity} entity.
 * Implements shared-domain {Entity} type.
 */
export class {Entity}ResponseDto implements {Entity} {
  @ApiProperty({
    description: 'Auto-generated {entity} ID',
    example: 1,
  })
  {entity}Id!: number

  @ApiProperty({
    description: 'Field description',
    example: 'Example value',
  })
  name!: string

  // Map all fields from shared-domain {Entity} type
  // Only @ApiProperty decorators for Swagger
}
```

---

### Step 4: Create Zod Validation Pipe (if not exists)

**File**: `/services/{service}/src/common/zod-validation.pipe.ts`

```typescript
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common'
import { ZodTypeAny } from 'zod'

/**
 * Validation pipe that uses Zod schemas for request body validation.
 * Transforms validation errors into BadRequestException which is then
 * converted to RFC 9457 Problem Details by ProblemDetailsFilter.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodTypeAny) {}

  transform(value: unknown) {
    const parsed = this.schema.safeParse(value)
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.format())
    }
    return parsed.data
  }
}
```

---

### Step 5: Create Service

**File**: `/services/{service}/src/modules/{entities}/{entities}.service.ts`

```typescript
import { Injectable, ConflictException, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, QueryFailedError } from 'typeorm'
import { {Entity}Entity } from '@exprealty/database'
import type { Create{Entity}Input, {Entity} } from '@exprealty/shared-domain'

/**
 * Service for managing {Entity} entities.
 */
@Injectable()
export class {Entities}Service {
  private readonly logger = new Logger({Entities}Service.name)

  constructor(
    @InjectRepository({Entity}Entity)
    private readonly {entity}Repository: Repository<{Entity}Entity>,
  ) {}

  /**
   * Creates a new {entity}.
   * 
   * @param dto - {Entity} data (validated by Zod)
   * @returns The created {entity}
   * @throws ConflictException if duplicate constraint violation
   */
  async create(dto: Create{Entity}Input): Promise<{Entity}> {
    try {
      // Trim string fields
      const entity = this.{entity}Repository.create({
        name: dto.name.trim(),
        // Map all fields
      })

      const saved = await this.{entity}Repository.save(entity)
      return this.mapToResponse(saved)
    } catch (error) {
      // Handle duplicate key violations (PostgreSQL error code 23505)
      if (
        error instanceof QueryFailedError &&
        'code' in error &&
        error.code === '23505'
      ) {
        throw new ConflictException({
          type: 'duplicate_{entity}',
          title: '{Entity} Already Exists',
          detail: `A {entity} with this identifier already exists`,
        })
      }
      throw error
    }
  }

  /**
   * Maps entity to domain type.
   */
  private mapToResponse(entity: {Entity}Entity): {Entity} {
    return {
      {entity}Id: entity.{entity}Id,
      name: entity.name,
      // Map all fields
    }
  }
}
```

---

### Step 6: Create Controller

**File**: `/services/{service}/src/modules/{entities}/{entities}.controller.ts`

```typescript
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UsePipes,
  Res,
  Req,
} from '@nestjs/common'
import { Response, Request } from 'express'
import { Create{Entity}InputSchema } from '@exprealty/shared-domain'
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js'
import { {Entities}Service } from './{entities}.service.js'
import { Create{Entity}Dto } from './dto/create-{entity}.dto.js'
import { {Entity}ResponseDto } from './dto/{entity}-response.dto.js'
import { v4 as uuidv4 } from 'uuid'

/**
 * Controller for {Entity} resource endpoints.
 */
@Controller('/v1/{entities}')
export class {Entities}Controller {
  constructor(private readonly {entities}Service: {Entities}Service) {}

  /**
   * POST /v1/{entities} - Create a new {entity}
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(Create{Entity}InputSchema))
  async create(
    @Body() dto: Create{Entity}Dto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ): Promise<{Entity}ResponseDto> {
    // Get or generate correlation ID
    const correlationId = 
      (req.headers['x-correlation-id'] as string) ||
      (req.headers['x-request-id'] as string) ||
      uuidv4()

    // Set correlation ID header
    res.setHeader('x-correlation-id', correlationId)

    // Create entity
    const created = await this.{entities}Service.create(dto)

    // Set Location header
    res.setHeader('Location', `/v1/{entities}/${created.{entity}Id}`)

    return created
  }
}
```

---

### Step 7: Create Module

**File**: `/services/{service}/src/modules/{entities}/{entities}.module.ts`

```typescript
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { {Entity}Entity } from '@exprealty/database'
import { {Entities}Controller } from './{entities}.controller.js'
import { {Entities}Service } from './{entities}.service.js'

/**
 * {Entities} Module
 */
@Module({
  imports: [TypeOrmModule.forFeature([{Entity}Entity])],
  controllers: [{Entities}Controller],
  providers: [{Entities}Service],
  exports: [{Entities}Service],
})
export class {Entities}Module {}
```

---

### Step 8: Wire into App Module

**File**: `/services/{service}/src/app.module.ts`

```typescript
import { {Entities}Module } from './modules/{entities}/{entities}.module.js'

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    {Entities}Module, // Add here
  ],
  // ...
})
export class AppModule {}
```

---

## Validation Flow

```
HTTP Request with JSON body
    ↓
@UsePipes(new ZodValidationPipe(Create{Entity}InputSchema))
    ↓
[Zod validates against shared-domain schema]
    ↓
Valid? → Controller receives typed dto: Create{Entity}Dto
Invalid? → BadRequestException → ProblemDetailsFilter → RFC 9457 response
    ↓
Service receives: Create{Entity}Input (type from shared-domain)
    ↓
Database operation with {Entity}Entity
    ↓
Service returns: {Entity} (type from shared-domain)
    ↓
Controller returns: {Entity}ResponseDto (implements {Entity})
    ↓
HTTP Response (201 Created with Location header)
```

---

## Key Rules

### ✅ DO:
- Define validation once in shared-domain using Zod
- Use `implements` to ensure DTOs match shared-domain types
- Use `ZodValidationPipe` with shared-domain schemas in controllers
- Use `@ApiProperty` for Swagger documentation
- Trim string inputs in service layer
- Handle PostgreSQL constraint violations (code 23505)
- Set correlation ID and Location headers

### ❌ DON'T:
- Use class-validator decorators in DTOs (`@IsString`, `@IsInt`, etc.)
- Duplicate validation logic across layers
- Put validation in controller or service
- Return TypeORM entities directly from controllers
- Forget to rebuild shared-domain after changes
- Mix validation approaches (stick to Zod)

---

## Testing Pattern

### Service Unit Tests
```typescript
describe('{Entities}Service', () => {
  let service: {Entities}Service
  let repository: Repository<{Entity}Entity>

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        {Entities}Service,
        {
          provide: getRepositoryToken({Entity}Entity),
          useValue: mockRepository,
        },
      ],
    }).compile()

    service = module.get({Entities}Service)
  })

  it('should create a {entity}', async () => {
    const dto: Create{Entity}Input = { name: 'Test' }
    const entity: {Entity}Entity = { {entity}Id: 1, name: 'Test' }
    
    mockRepository.create.mockReturnValue(entity)
    mockRepository.save.mockResolvedValue(entity)

    const result = await service.create(dto)
    
    expect(result.{entity}Id).toBe(1)
  })
})
```

### Controller Unit Tests
```typescript
describe('{Entities}Controller', () => {
  let controller: {Entities}Controller
  let service: {Entities}Service

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [{Entities}Controller],
      providers: [
        {
          provide: {Entities}Service,
          useValue: { create: jest.fn() },
        },
      ],
    }).compile()

    controller = module.get({Entities}Controller)
    service = module.get({Entities}Service)
  })

  it('should set Location header on create', async () => {
    const mockRes = { setHeader: jest.fn() }
    const mockReq = { headers: {} }
    
    jest.spyOn(service, 'create').mockResolvedValue({ 
      {entity}Id: 1, 
      name: 'Test' 
    })

    await controller.create(
      { name: 'Test' },
      mockRes as any,
      mockReq as any,
    )

    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Location',
      '/v1/{entities}/1'
    )
  })
})
```

---

## Query Parameter Validation

### HTTP Query Parameters with Type Coercion

Query parameters arrive as strings but often need to be numbers or booleans. Use `z.coerce` for automatic conversion.

#### Pagination Example

**Shared-domain schema** (already exists in `packages/shared-domain/src/common/paging.ts`):
```typescript
import { z } from 'zod'

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
})
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>
```

#### Controller with Query Parameters

```typescript
import { Controller, Get, Query, UsePipes } from '@nestjs/common'
import { PaginationQuerySchema, type PaginationQuery } from '@exprealty/shared-domain'
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js'

@Controller('/v1/{entities}')
export class {Entities}Controller {
  constructor(private readonly {entities}Service: {Entities}Service) {}

  /**
   * GET /v1/{entities}?page=2&limit=20
   */
  @Get()
  @UsePipes(new ZodValidationPipe(PaginationQuerySchema))
  async findAll(@Query() query: PaginationQuery) {
    // query.page is number (default: 1)
    // query.limit is number (default: 10)
    return this.{entities}Service.findAll(query.page, query.limit)
  }
}
```

#### Custom Query Schema with Filters

```typescript
// In shared-domain
export const Get{Entities}QuerySchema = z.object({
  // Pagination
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  
  // Filters
  status: z.enum(['active', 'inactive']).optional(),
  search: z.string().min(2).max(100).optional(),
  
  // Boolean filter (query param comes as "true"/"false" string)
  includeDeleted: z
    .enum(['true', 'false'])
    .transform(val => val === 'true')
    .optional(),
  
  // Date filter with coercion
  createdAfter: z.coerce.date().optional(),
})
export type Get{Entities}Query = z.infer<typeof Get{Entities}QuerySchema>
```

#### How z.coerce Works

| Query String | Without Coerce | With z.coerce.number() |
|--------------|----------------|------------------------|
| `?page=2` | `"2"` (string) | `2` (number) |
| `?limit=abc` | `"abc"` (string) | Validation error ❌ |
| `?active=true` | `"true"` (string) | Need `.transform()` for boolean |

#### Key Points

- **Always use `z.coerce`** for numeric query parameters
- **Use `.enum(['true', 'false']).transform()`** for boolean query parameters
- **Provide defaults** with `.default()` for optional parameters
- **Apply `@UsePipes(new ZodValidationPipe(schema))`** to the controller method
- The DTO class is optional for query params (type is sufficient)

---

## Common Patterns

### Optional Fields in Input Schema
```typescript
export const Create{Entity}InputSchema = {Entity}BaseSchema
  .omit({ {entity}Id: true })
  .extend({
    optionalField: z.string().optional(),
  })
```

### Unique Constraint Error Handling
```typescript
if (error instanceof QueryFailedError && error.code === '23505') {
  const constraintName = (error as any).constraint
  throw new ConflictException({
    type: 'duplicate_{entity}',
    title: '{Entity} Already Exists',
    detail: `Duplicate value for ${constraintName}`,
  })
}
```

### Relationships in Expanded Schema
```typescript
export const {Entity}ExpandedSchema = {Entity}BaseSchema.extend({
  relatedEntities: z.array(z.number()).optional(),
})
```

---

## Checklist

- [ ] Defined schema in `/packages/shared-domain/src/entities/`
- [ ] Exported from shared-domain index
- [ ] Rebuilt shared-domain package
- [ ] Created TypeORM entity in `/packages/database/`
- [ ] Created DTOs (implements shared-domain types)
- [ ] Created ZodValidationPipe (if needed)
- [ ] Created service (uses shared-domain types)
- [ ] Created controller (uses ZodValidationPipe)
- [ ] Created module with TypeORM.forFeature
- [ ] Wired module into app.module
- [ ] Added unit tests for service and controller
- [ ] Verified no class-validator decorators in DTOs
- [ ] Tested endpoint with valid and invalid data

---

## Example: Countries Implementation

See the countries module for a complete reference implementation:
- `packages/shared-domain/src/entities/country.ts`
- `packages/database/src/entities/country.entity.ts`
- `services/agent-service/src/modules/countries/`

---

## Troubleshooting

**Type errors in DTOs**: Rebuild shared-domain package
```bash
pnpm --filter @exprealty/shared-domain build
```

**Validation not working**: Check that `@UsePipes(new ZodValidationPipe(schema))` is on the controller method

**TypeORM entity not found**: Ensure entity is registered in module's `TypeOrmModule.forFeature([])`

**Import errors**: Use `.js` extensions for local imports in ESM modules
