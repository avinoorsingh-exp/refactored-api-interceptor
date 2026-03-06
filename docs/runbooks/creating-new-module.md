# Runbook: Creating a New Module

This runbook guides you through creating a complete new feature module with all layers.

## Prerequisites

1. Read `docs/architecture/api-patterns.md`
2. Read `docs/architecture/repository-patterns.md`
3. Read `docs/architecture/entity-patterns.md`
4. Understand the domain concept you're implementing

## Module Structure

```
modules/my-resources/
├── ports/
│   └── my-resource.repository.port.ts    # Interface (PORT)
├── dto/
│   ├── create-my-resource.dto.ts
│   ├── update-my-resource.dto.ts
│   ├── my-resource-response.dto.ts
│   └── my-resource-id-param.dto.ts
├── config/
│   └── my-resource.projection.config.ts   # Field projection config
├── my-resource.controller.ts              # HTTP layer
├── my-resource.service.ts                 # Business logic
├── my-resource.repository.ts              # TypeORM adapter
└── my-resource.module.ts                  # DI wiring
```

## Step-by-Step Guide

### 1. Create Domain Schema

```typescript
// packages/shared-domain/src/schemas/my-resource.ts
import { z } from 'zod';

// Create schema (input)
export const CreateMyResourceSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
});

// Update schema (partial input)
export const UpdateMyResourceSchema = CreateMyResourceSchema.partial();

// Base schema (list view)
export const MyResourceBaseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Expanded schema (detail view)
export const MyResourceExpandedSchema = MyResourceBaseSchema.extend({
  description: z.string().optional(),
  createdBy: z.string().uuid().optional(),
});

// Type exports
export type CreateMyResource = z.infer<typeof CreateMyResourceSchema>;
export type UpdateMyResource = z.infer<typeof UpdateMyResourceSchema>;
export type MyResource = z.infer<typeof MyResourceExpandedSchema>;
export type MyResourceBase = z.infer<typeof MyResourceBaseSchema>;
```

### 2. Create Entity

```typescript
// packages/database/src/entities/core/my-resource.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn
} from 'typeorm';
import { Searchable, Filterable, Sortable } from '../decorators/searchable-decorators.js';

@Entity({ name: 'my_resource', schema: 'core' })
export class MyResourceEntity {
  @PrimaryGeneratedColumn('uuid')
  @Searchable({ weight: 3, behavior: 'exact', description: 'ID' })
  @Filterable()
  @Sortable()
  id!: string;

  @Column({ name: 'name', type: 'text' })
  @Searchable({ weight: 10, behavior: 'partial', description: 'Name' })
  @Filterable()
  @Sortable()
  name!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  @Searchable({ weight: 5, behavior: 'partial', description: 'Description' })
  description?: string;

  @Column({ name: 'status', type: 'text', default: 'draft' })
  @Searchable({ weight: 6, behavior: 'exact', description: 'Status' })
  @Filterable()
  @Sortable()
  status!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  @Filterable()
  @Sortable()
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  @Filterable()
  @Sortable()
  updatedAt!: Date;
}
```

### 3. Generate and Run Migration

```bash
cd packages/database
pnpm migration:generate -- -n CreateMyResourceTable
# Review migration, make idempotent
pnpm migration:run
pnpm build
```

### 4. Create Port Interface

```typescript
// modules/my-resources/ports/my-resource.repository.port.ts
import { IRepository, PageResult, QueryParams } from '@common/database/repository.interface';
import { MyResource } from '@exprealty/shared-domain';

export interface IMyResourceRepository extends IRepository<MyResource, string> {
  findByName(name: string): Promise<MyResource | null>;
}
```

### 5. Create DTOs

```typescript
// modules/my-resources/dto/create-my-resource.dto.ts
import { CreateMyResourceSchema } from '@exprealty/shared-domain';
import { createZodDto } from 'nestjs-zod';

export class CreateMyResourceDto extends createZodDto(CreateMyResourceSchema) {}

// modules/my-resources/dto/update-my-resource.dto.ts
import { UpdateMyResourceSchema } from '@exprealty/shared-domain';
import { createZodDto } from 'nestjs-zod';

export class UpdateMyResourceDto extends createZodDto(UpdateMyResourceSchema) {}

// modules/my-resources/dto/my-resource-response.dto.ts
import { MyResourceBaseSchema } from '@exprealty/shared-domain';
import { z } from 'zod';

export type MyResourceResponseDto = z.infer<typeof MyResourceBaseSchema>;

// modules/my-resources/dto/my-resource-id-param.dto.ts
import { z } from 'zod';

export const MyResourceIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type MyResourceIdParamDto = z.infer<typeof MyResourceIdParamSchema>;
```

### 6. Create Projection Config

```typescript
// modules/my-resources/config/my-resource.projection.config.ts
import { ProjectionConfig } from '@common/query/projection.service';

export const MY_RESOURCE_PROJECTION_CONFIG: ProjectionConfig = {
  allowedFields: ['id', 'name', 'description', 'status', 'createdAt', 'updatedAt'],
  requiredFields: ['id'],
  defaultFields: ['id', 'name', 'status', 'createdAt'],
  relations: {},
  presets: {
    minimal: {
      fields: ['id', 'name'],
    },
    default: {
      fields: ['id', 'name', 'status', 'createdAt', 'updatedAt'],
    },
  },
};
```

### 7. Create Repository

```typescript
// modules/my-resources/my-resource.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MyResourceEntity } from '@exprealty/database';
import { IMyResourceRepository } from './ports/my-resource.repository.port';
import { MyResource, PageResult, QueryParams } from '@exprealty/shared-domain';
import { QueryService } from '@common/query/query.service';
import { ProjectionService } from '@common/query/projection.service';
import { MY_RESOURCE_PROJECTION_CONFIG } from './config/my-resource.projection.config';

@Injectable()
export class MyResourceTypeOrmRepository implements IMyResourceRepository {
  constructor(
    @InjectRepository(MyResourceEntity)
    private readonly repo: Repository<MyResourceEntity>,
    private readonly queryService: QueryService,
    private readonly projectionService: ProjectionService,
  ) {}

  async findById(id: string): Promise<MyResource | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.mapToDomain(entity) : null;
  }

  async findByName(name: string): Promise<MyResource | null> {
    const entity = await this.repo.findOne({ where: { name } });
    return entity ? this.mapToDomain(entity) : null;
  }

  async findPage(query: QueryParams): Promise<PageResult<MyResource>> {
    const qb = this.repo.createQueryBuilder('resource');

    this.queryService.applyQuery(qb, query, MyResourceEntity);

    const [entities, total] = await qb
      .skip(query.offset ?? 0)
      .take(query.limit ?? 25)
      .getManyAndCount();

    return {
      items: entities.map(e => this.mapToDomain(e)),
      total,
    };
  }

  async create(input: Partial<MyResource>): Promise<MyResource> {
    const entity = this.repo.create(input);
    const saved = await this.repo.save(entity);
    return this.mapToDomain(saved);
  }

  async update(id: string, patch: Partial<MyResource>): Promise<MyResource> {
    await this.repo.update(id, patch);
    const entity = await this.repo.findOneOrFail({ where: { id } });
    return this.mapToDomain(entity);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  private mapToDomain(entity: MyResourceEntity): MyResource {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description,
      status: entity.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
```

#### Pagination Performance

If the entity has 1:N child relations that will be included via `?include=`:

1. Mark the relation as `virtual: true` in the projection config
2. Strip it from includes before `findWithQuery()` (like `contactMethod` in AgentRepository)
3. Add a private `loadXxxByIds(ids: string[])` method with raw SQL
4. Add a post-query helper function that chains after `findWithQuery()`

See `docs/architecture/repository-patterns.md` → "Pagination Performance — Post-Query Loading" for the full pattern.

### 8. Create Service

```typescript
// modules/my-resources/my-resource.service.ts
import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { IMyResourceRepository } from './ports/my-resource.repository.port';
import { CreateMyResourceDto, UpdateMyResourceDto } from './dto';
import { MyResource, PageResult, QueryParams } from '@exprealty/shared-domain';

@Injectable()
export class MyResourceService {
  constructor(
    @Inject('IMyResourceRepository')
    private readonly repository: IMyResourceRepository,
  ) {}

  async findAll(query: QueryParams): Promise<PageResult<MyResource>> {
    return this.repository.findPage(query);
  }

  async findById(id: string): Promise<MyResource> {
    const resource = await this.repository.findById(id);
    if (!resource) {
      throw new NotFoundException({
        message: `Resource with id '${id}' not found`,
        i18nType: 'my_resource.not_found',
      });
    }
    return resource;
  }

  async create(dto: CreateMyResourceDto): Promise<MyResource> {
    const existing = await this.repository.findByName(dto.name);
    if (existing) {
      throw new ConflictException({
        message: `Resource with name '${dto.name}' already exists`,
        i18nType: 'my_resource.name_exists',
      });
    }
    return this.repository.create(dto);
  }

  async update(id: string, dto: UpdateMyResourceDto): Promise<MyResource> {
    await this.findById(id); // Throws if not found
    return this.repository.update(id, dto);
  }

  async delete(id: string): Promise<void> {
    await this.findById(id); // Throws if not found
    return this.repository.delete(id);
  }
}
```

### 9. Create Controller

```typescript
// modules/my-resources/my-resource.controller.ts
import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, HttpCode, HttpStatus, Res,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { ZodValidationPipe } from '@common/zod-validation.pipe';
import { PaginationInterceptor } from '@common/pagination/pagination.interceptor';
import { CreateMyResourceSchema, UpdateMyResourceSchema } from '@exprealty/shared-domain';
import { MyResourceService } from './my-resource.service';
import {
  CreateMyResourceDto, UpdateMyResourceDto,
  MyResourceIdParamDto, MyResourceIdParamSchema,
  MyResourceResponseDto,
} from './dto';

@ApiTags('my-resources')
@Controller('v1/my-resources')
export class MyResourceController {
  constructor(private readonly service: MyResourceService) {}

  @Get()
  @UseInterceptors(PaginationInterceptor)
  @ApiOperation({ summary: 'List all resources' })
  @ApiResponse({ status: 200, description: 'List of resources' })
  async findAll(@Query() query: any): Promise<{ items: MyResourceResponseDto[]; total: number }> {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get resource by ID' })
  @ApiResponse({ status: 200, description: 'Resource found' })
  @ApiResponse({ status: 404, description: 'Resource not found' })
  async findById(
    @Param(new ZodValidationPipe(MyResourceIdParamSchema)) params: MyResourceIdParamDto,
  ): Promise<MyResourceResponseDto> {
    return this.service.findById(params.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a resource' })
  @ApiResponse({ status: 201, description: 'Resource created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Resource already exists' })
  async create(
    @Body(new ZodValidationPipe(CreateMyResourceSchema, 'my_resource.validation'))
    dto: CreateMyResourceDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MyResourceResponseDto> {
    const resource = await this.service.create(dto);
    res.setHeader('Location', `/v1/my-resources/${resource.id}`);
    return resource;
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a resource' })
  @ApiResponse({ status: 200, description: 'Resource updated' })
  @ApiResponse({ status: 404, description: 'Resource not found' })
  async update(
    @Param(new ZodValidationPipe(MyResourceIdParamSchema)) params: MyResourceIdParamDto,
    @Body(new ZodValidationPipe(UpdateMyResourceSchema, 'my_resource.validation'))
    dto: UpdateMyResourceDto,
  ): Promise<MyResourceResponseDto> {
    return this.service.update(params.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a resource' })
  @ApiResponse({ status: 204, description: 'Resource deleted' })
  @ApiResponse({ status: 404, description: 'Resource not found' })
  async delete(
    @Param(new ZodValidationPipe(MyResourceIdParamSchema)) params: MyResourceIdParamDto,
  ): Promise<void> {
    return this.service.delete(params.id);
  }
}
```

### 10. Create Module

```typescript
// modules/my-resources/my-resource.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MyResourceEntity } from '@exprealty/database';
import { MyResourceController } from './my-resource.controller';
import { MyResourceService } from './my-resource.service';
import { MyResourceTypeOrmRepository } from './my-resource.repository';

@Module({
  imports: [TypeOrmModule.forFeature([MyResourceEntity])],
  controllers: [MyResourceController],
  providers: [
    MyResourceService,
    {
      provide: 'IMyResourceRepository',
      useClass: MyResourceTypeOrmRepository,
    },
  ],
  exports: ['IMyResourceRepository'],
})
export class MyResourceModule {}
```

### 11. Register in App Module

```typescript
// app.module.ts
import { MyResourceModule } from './modules/my-resources/my-resource.module';

@Module({
  imports: [
    // ... existing imports
    MyResourceModule,
  ],
})
export class AppModule {}
```

### 12. Add Tests and Verify

```bash
# Build everything
pnpm build

# Run tests
pnpm test:unit

# Start and test
pnpm dev
curl http://localhost:3000/v1/my-resources
```

## Checklist

- [ ] Domain schema created in shared-domain
- [ ] Entity created with decorators
- [ ] Migration generated and tested
- [ ] Port interface defined
- [ ] DTOs created
- [ ] Projection config defined
- [ ] Repository adapter implemented
- [ ] Service with business logic
- [ ] Controller with all endpoints
- [ ] Module wired with DI
- [ ] Registered in AppModule
- [ ] Unit tests for service
- [ ] E2E tests for endpoints
- [ ] Build succeeds
- [ ] Manual testing complete
