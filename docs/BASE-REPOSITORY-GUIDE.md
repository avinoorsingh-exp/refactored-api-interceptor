# BaseTypeOrmRepository Implementation Guide

This document describes how to implement a new repository using the `BaseTypeOrmRepository` abstract class.

## Overview

The `BaseTypeOrmRepository` provides a standardized way to implement TypeORM repositories with:

- **CRUD operations**: `findById`, `findAll`, `create`, `update`, `delete`
- **Query support**: Filtering, sorting, searching, pagination
- **Field projection**: Select specific fields, include relations
- **Entity-to-domain mapping**: Separate persistence and domain models
- **Cursor pagination**: Efficient pagination for large datasets

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Controller                                │
│  - Extracts query params, fields, include                       │
│  - Calls service methods                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Service                                  │
│  - Business logic, validation                                   │
│  - Calls repository via PORT interface                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              IRepository<TId, TEntity> (PORT)                   │
│  - findById, findPage, create, update, delete                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              BaseTypeOrmRepository (ADAPTER)                    │
│  - Abstract base class                                          │
│  - Implements common CRUD operations                            │
│  - Uses QueryService, ProjectionService                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│             ConcreteRepository (e.g., StatesRepository)         │
│  - Extends BaseTypeOrmRepository                                │
│  - Implements abstract methods                                  │
│  - Adds entity-specific methods                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Step-by-Step Implementation

### 1. Create the Entity

Define the TypeORM entity with query decorators:

```typescript
// packages/database/src/entities/core/example.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { AuditableEntity } from './auditable.entity.js';
import { Searchable, Filterable, Sortable } from '../../decorators/searchable-decorators.js';

@Entity({ name: 'example', schema: 'core' })
export class ExampleEntity extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid')
  @Filterable()
  id!: string;

  @Column({ type: 'text' })
  @Searchable({ weight: 10, behavior: 'partial', description: 'Example name' })
  @Filterable()
  @Sortable()
  name!: string;

  @Column({ name: 'is_active', type: 'boolean' })
  @Filterable()
  isActive!: boolean;

  @Column({ name: 'parent_id', type: 'integer' })
  @Searchable({ type: 'integer', weight: 3, behavior: 'exact', description: 'Parent reference' })
  @Filterable()
  parentId!: number;

  @ManyToOne(() => ParentEntity, { eager: false })
  @JoinColumn({ name: 'parent_id' })
  parent?: ParentEntity;
}
```

**Export from database package:**

```typescript
// packages/database/src/entities/index.ts
export { ExampleEntity } from './core/example.entity.js';
```

### 2. Create the Domain Schema

Define Zod schemas in shared-domain:

```typescript
// packages/shared-domain/src/schemas/example.ts
import { z } from 'zod';
import { InstantUTC } from '../value-objects/dates.js';

export const ExampleBaseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  isActive: z.boolean(),
  parentId: z.number().int(),
  created: InstantUTC,
  lastModified: InstantUTC,
  modifiedBy: z.string().max(255),
});

export type ExampleBase = z.infer<typeof ExampleBaseSchema>;

export const ExampleExpandedSchema = ExampleBaseSchema.extend({
  parent: z.lazy(() => z.any()).optional(),
});

export type Example = z.infer<typeof ExampleExpandedSchema>;

// Input schemas (omit auto-generated fields)
export const CreateExampleInputSchema = ExampleBaseSchema.omit({
  id: true,
  created: true,
  lastModified: true,
  modifiedBy: true,
});

export type CreateExampleInput = z.infer<typeof CreateExampleInputSchema>;

export const UpdateExampleInputSchema = CreateExampleInputSchema.partial();
export type UpdateExampleInput = z.infer<typeof UpdateExampleInputSchema>;
```

### 3. Create the Projection Config

Define projection configuration for field selection:

```typescript
// services/agent-service/src/modules/examples/config/examples-projection.config.ts
import { ProjectionConfig } from '@exprealty/shared-domain';

export const EXAMPLES_PROJECTION_CONFIG: ProjectionConfig = {
  // Always included (primary key)
  required: ['id'],

  // Fields allowed for projection
  allowed: [
    'id',
    'name',
    'isActive',
    'parentId',
    'created',
    'lastModified',
    'modifiedBy',
  ],

  // Default fields when no ?fields specified
  default: [
    'id',
    'name',
    'isActive',
    'parentId',
    'created',
    'lastModified',
    'modifiedBy',
  ],

  // Available relations for ?include
  relations: {
    parent: {
      property: 'parent',
      fields: ['id', 'name'],
    },
  },
};
```

### 4. Create the Repository Port (Interface)

Define the repository contract:

```typescript
// services/agent-service/src/modules/examples/ports/examples.repository.port.ts
import type { IRepository } from '../../../common/ports/repository.base.js';
import type { Example } from '@exprealty/shared-domain';

export interface IExamplesRepository extends IRepository<string, Example> {
  // Add entity-specific methods
  findByName(name: string): Promise<Example | null>;
  findByParentId(parentId: number): Promise<Example[]>;
}
```

### 5. Implement the Repository

Extend `BaseTypeOrmRepository`:

```typescript
// services/agent-service/src/modules/examples/examples.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExampleEntity } from '@exprealty/database';
import type { Example, QueryParams, FieldSelection } from '@exprealty/shared-domain';
import type { IExamplesRepository } from './ports/examples.repository.port.js';
import type { PageResult } from '../../common/ports/pagination.types.js';
import { QueryService } from '../../common/query/query.service.js';
import { LoggerService } from '../../core/logger.service.js';
import { ProjectionService } from '../../common/query/projection.service.js';
import { BaseTypeOrmRepository, BaseQueryConfig } from '../../common/database/IRepository.js';
import { EXAMPLES_PROJECTION_CONFIG } from './config/examples-projection.config.js';

/**
 * Query configuration - defines what fields can be filtered/sorted/searched
 */
const EXAMPLES_QUERY_CONFIG: BaseQueryConfig = {
  allowedFilterFields: ['id', 'name', 'isActive', 'parentId'],
  allowedSortFields: ['name', 'created', 'lastModified'],
  allowedSearchFields: ['name'],
  defaultSort: { field: 'name', direction: 'ASC' },
  projectionConfig: EXAMPLES_PROJECTION_CONFIG,
};

@Injectable()
export class ExamplesTypeOrmRepository
  extends BaseTypeOrmRepository<ExampleEntity, Example, string>
  implements IExamplesRepository
{
  constructor(
    @InjectRepository(ExampleEntity)
    repo: Repository<ExampleEntity>,
    queryService: QueryService,
    logger: LoggerService,
    projectionService: ProjectionService,
  ) {
    super(repo, queryService, logger, projectionService);
    this.logger.setContext('ExamplesRepository');
  }

  // -------------------------------------------------------------------------
  // Required Abstract Method Implementations
  // -------------------------------------------------------------------------

  protected getEntityClass(): new () => ExampleEntity {
    return ExampleEntity;
  }

  protected getQueryConfig(): BaseQueryConfig {
    return EXAMPLES_QUERY_CONFIG;
  }

  protected getAlias(): string {
    return 'example';
  }

  /**
   * Maps TypeORM entity to domain model
   */
  protected mapToDomain(entity: ExampleEntity): Example {
    return {
      id: entity.id,
      name: entity.name,
      isActive: entity.isActive,
      parentId: entity.parentId,
      created: entity.created as Example['created'],
      lastModified: entity.lastModified as Example['lastModified'],
      modifiedBy: entity.modifiedBy,
      parent: entity.parent
        ? { id: entity.parent.id, name: entity.parent.name }
        : undefined,
    };
  }

  /**
   * Maps domain data to entity for persistence
   */
  protected mapToEntity(data: Partial<Example>): Partial<ExampleEntity> {
    const entityData: Partial<ExampleEntity> = {};

    if (data.name !== undefined) entityData.name = data.name;
    if (data.isActive !== undefined) entityData.isActive = data.isActive;
    if (data.parentId !== undefined) entityData.parentId = data.parentId;
    if (data.modifiedBy !== undefined) entityData.modifiedBy = data.modifiedBy;

    return entityData;
  }

  // -------------------------------------------------------------------------
  // IExamplesRepository-specific methods
  // -------------------------------------------------------------------------

  async findByName(name: string): Promise<Example | null> {
    const entity = await this.repo.findOne({ where: { name } });
    return entity ? this.mapToDomain(entity) : null;
  }

  async findByParentId(parentId: number): Promise<Example[]> {
    const entities = await this.repo.find({ where: { parentId } });
    return entities.map((e) => this.mapToDomain(e));
  }

  /**
   * Override findPage to support field selection
   */
  async findPage(
    query: Partial<QueryParams>,
    selection?: FieldSelection,
  ): Promise<PageResult<Example>> {
    return this.findWithQuery(query, selection);
  }
}
```

### 6. Create the Service

Implement business logic:

```typescript
// services/agent-service/src/modules/examples/examples.service.ts
import { Injectable, ConflictException, NotFoundException, Inject } from '@nestjs/common';
import type { IExamplesRepository } from './ports/examples.repository.port.js';
import type { CreateExampleInput, UpdateExampleInput, Example, QueryParams, FieldSelection } from '@exprealty/shared-domain';

@Injectable()
export class ExamplesService {
  constructor(
    @Inject('IExamplesRepository')
    private readonly repository: IExamplesRepository,
  ) {}

  async create(dto: CreateExampleInput): Promise<Example> {
    // Check for duplicates if needed
    const existing = await this.repository.findByName(dto.name);
    if (existing) {
      throw new ConflictException(`Example with name '${dto.name}' already exists`);
    }

    return this.repository.create(dto);
  }

  async findById(id: string): Promise<Example> {
    const example = await this.repository.findById(id);
    if (!example) {
      throw new NotFoundException(`Example with id '${id}' not found`);
    }
    return example;
  }

  async findPage(
    query: Partial<QueryParams>,
    selection?: FieldSelection,
  ): Promise<{ examples: Example[]; total: number }> {
    const result = await this.repository.findPage(query, selection);
    return { examples: result.items, total: result.total };
  }

  async update(id: string, dto: UpdateExampleInput): Promise<Example> {
    // Verify exists
    await this.findById(id);
    return this.repository.update(id, dto);
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    return this.repository.delete(id);
  }
}
```

### 7. Create the Module

Wire everything together:

```typescript
// services/agent-service/src/modules/examples/examples.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExampleEntity, ParentEntity } from '@exprealty/database';
import { ExamplesController } from './examples.controller.js';
import { ExamplesService } from './examples.service.js';
import { ExamplesTypeOrmRepository } from './examples.repository.js';
import { QueryService } from '../../common/query/query.service.js';
import { ProjectionService } from '../../common/query/projection.service.js';

@Module({
  imports: [
    // Register all entities involved in relationships
    TypeOrmModule.forFeature([ExampleEntity, ParentEntity]),
  ],
  controllers: [ExamplesController],
  providers: [
    ExamplesService,
    QueryService,
    ProjectionService,
    // Provide repository under port token
    {
      provide: 'IExamplesRepository',
      useClass: ExamplesTypeOrmRepository,
    },
  ],
  exports: [ExamplesService],
})
export class ExamplesModule {}
```

### 8. Update Controller to Pass Field Selection

```typescript
// In controller's findAll method:
@Get()
@UseInterceptors(PaginationInterceptor)
async findAll(@Query() query: any): Promise<{ items: Example[]; total: number }> {
  // Extract field selection from query params
  const selection = {
    fields: query.fields?.split(',').map((f: string) => f.trim()),
    include: query.include?.split(',').map((r: string) => r.trim()),
  };

  const { examples, total } = await this.service.findPage(query, selection);
  return { items: examples, total };
}
```

## Abstract Methods Reference

| Method | Return Type | Description |
|--------|-------------|-------------|
| `mapToDomain(entity)` | `TDomain` | Convert TypeORM entity to domain model |
| `mapToEntity(data)` | `Partial<TEntity>` | Convert domain data to entity for persistence |
| `getEntityClass()` | `new () => TEntity` | Return the entity class constructor |
| `getQueryConfig()` | `BaseQueryConfig` | Return query configuration |
| `getAlias()` | `string` | Return query builder alias (default: `'entity'`) |

## Inherited Methods

| Method | Description |
|--------|-------------|
| `findById(id)` | Find single entity by ID |
| `findAll(params)` | Find all with pagination (calls `findWithQuery`) |
| `create(data)` | Create new entity |
| `update(id, data)` | Update existing entity |
| `delete(id)` | Delete entity by ID |
| `findWithQuery(params, selection?, customize?)` | Protected: Execute query with filters/sort/search/projection |
| `findWithCursor(cursorField, cursor, limit, params, selection?)` | Protected: Cursor-based pagination |

## BaseQueryConfig Interface

```typescript
interface BaseQueryConfig {
  /** Fields allowed for filtering */
  allowedFilterFields: string[];
  
  /** Fields allowed for sorting */
  allowedSortFields: string[];
  
  /** Fields allowed for text search */
  allowedSearchFields: string[];
  
  /** Projection configuration */
  projectionConfig?: ProjectionConfig;
  
  /** Default sort when none specified */
  defaultSort?: { field: string; direction: 'ASC' | 'DESC' };
}
```

## Checklist for New Repository

- [ ] Create TypeORM entity with decorators:
  - `@Filterable()` for filterable fields
  - `@Sortable()` for sortable fields
  - `@Searchable({ weight, behavior, type, description })` for searchable fields
- [ ] Export entity from `@exprealty/database`
- [ ] Create Zod schemas in `@exprealty/shared-domain`
- [ ] Create projection config file
- [ ] Create repository port interface
- [ ] Register entity in `MetadataModule` for metadata API discovery
- [ ] Implement repository extending `BaseTypeOrmRepository`
- [ ] Implement all abstract methods
- [ ] Create service with business logic
- [ ] Create module with proper providers
- [ ] Register entities in `TypeOrmModule.forFeature()`
- [ ] Update controller to pass `FieldSelection`
- [ ] Add DTOs for OpenAPI documentation
- [ ] Create migration if schema changes needed
