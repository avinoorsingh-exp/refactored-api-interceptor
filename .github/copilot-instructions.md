# eXpRealty Platform - Copilot Instructions

Global coding standards and patterns for AI-assisted development.

## Project Overview

This is a **NestJS microservices monorepo** for managing real estate agents, companies, offices, and related business entities. Built with **TypeScript**, **TypeORM**, and **PostgreSQL**.

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Runtime | Node.js 22 | JavaScript runtime (Volta managed) |
| Language | TypeScript 5.8 | Type-safe development |
| Framework | NestJS 10 | Microservices framework |
| Database | PostgreSQL 15 | Primary data store |
| ORM | TypeORM 0.3 | Database abstraction |
| Validation | Zod | Runtime type validation |
| Testing | Jest | Unit and integration tests |

### Monorepo Structure

```
packages/                    # Shared libraries
├── shared-domain/          # Domain types (Zod schemas, types)
├── database/               # TypeORM entities, decorators
├── logger/                 # Winston logging
├── config/                 # Environment configuration
└── cache/                  # Redis cache abstraction

services/                    # Microservices
├── agent-service/          # Agent domain service (main API)
└── orchestrator/           # API Gateway / BFF
```

---

## Architecture: Hexagonal (Ports & Adapters)

```
Controller (HTTP) → Service (Business Logic) → Repository PORT → Repository ADAPTER (TypeORM)
```

### Layer Responsibilities

| Layer | Location | Responsibility |
|-------|----------|----------------|
| **Presentation** | `modules/{entity}/{entity}.controller.ts` | HTTP endpoints, validation pipes |
| **Application** | `modules/{entity}/{entity}.service.ts` | Business logic, orchestration |
| **Domain** | `@exprealty/shared-domain` | Pure types, Zod schemas |
| **Ports** | `modules/{entity}/ports/*.port.ts` | Repository interfaces |
| **Adapters** | `modules/{entity}/{entity}.repository.ts` | TypeORM implementation |
| **Infrastructure** | `@exprealty/database` | Entities, decorators, migrations |

### Dependency Inversion

- Services depend on **PORT interfaces**, not concrete repositories
- Repositories are injected via **token**: `@Inject('IEntityRepository')`
- Module wires adapter to port: `{ provide: 'IEntityRepository', useClass: EntityTypeOrmRepository }`

---

## Entity Design Patterns

### TypeORM Entities (`@exprealty/database`)

```typescript
@Entity({ name: 'entity_name', schema: 'core' })
export class EntityEntity extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid')  // or 'increment' for bigint
  @Searchable({ weight: 3, behavior: 'exact', description: '...' })
  @Filterable()
  @Sortable()
  id!: string;

  @Column({ name: 'field_name', type: 'text' })  // Always specify column name for multi-word
  @Searchable({ weight: 8, behavior: 'partial', description: '...' })
  @Filterable()
  @Sortable()
  fieldName!: string;
}
```

### Decorator Patterns

| Decorator | Purpose | Options |
|-----------|---------|---------|
| `@Searchable` | Enable search on field | `weight`, `behavior`, `type`, `validate`, `description` |
| `@Filterable` | Enable filtering | `operators` (eq, contains, between, etc.) |
| `@Sortable` | Enable sorting | Default: ASC/DESC |
| `SearchValidators.bigint` | Validate bigint range | Prevents PostgreSQL overflow |
| `SearchValidators.integer` | Validate integer range | Prevents overflow |

### Base Classes

- **AuditableEntity**: Provides `created`, `lastModified`, `modifiedBy` fields
- **BaseTypeOrmRepository**: Provides `findById`, `findPage`, `create`, `update`, `delete`

---

## Controller Patterns

### Standard Endpoints

```typescript
@ApiTags('entities')
@Controller('v1/entities')
export class EntityController {
  constructor(private readonly service: EntityService) {}

  @Get()
  @UseInterceptors(PaginationInterceptor)
  async findAll(@Query() query: any) {
    return { items: [...], total: 100 };  // PaginationInterceptor wraps
  }

  @Get(':id')
  async findById(
    @Param(new ZodValidationPipe(IdSchema, 'entity.validation'))
    params: IdDto
  ) {
    return this.service.findById(params.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ZodValidationPipe(CreateSchema, 'entity.validation'))
    body: CreateDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const entity = await this.service.create(body);
    res.setHeader('Location', `/v1/entities/${entity.id}`);
    return entity;
  }

  @Put(':id')
  async update(@Param() params: IdDto, @Body() body: UpdateDto) {
    return this.service.update(params.id, body);
  }
}
```

### Validation is Automatic

1. **Input**: `ZodValidationPipe` validates with Zod schemas
2. **Search/Filter**: Entity decorators + `SearchValidatorService` = automatic validation
3. **Errors**: Global `ProblemDetailsFilter` formats all exceptions as RFC 9457

---

## Repository Patterns

### Repository Structure

```typescript
@Injectable()
export class EntityTypeOrmRepository
  extends BaseTypeOrmRepository<EntityEntity, EntityType, string>
  implements IEntityRepository
{
  constructor(
    @InjectRepository(EntityEntity) repo: Repository<EntityEntity>,
    queryService: QueryService,
    logger: LoggerService,
    projectionService: ProjectionService,
  ) {
    super(repo, queryService, logger, projectionService);
  }

  protected getEntityClass() { return EntityEntity; }
  protected getQueryConfig(): BaseQueryConfig { return ENTITY_QUERY_CONFIG; }
  protected getAlias(): string { return 'entity'; }
  protected mapToDomain(entity: EntityEntity): EntityType { /* ... */ }
  protected mapToEntity(data: Partial<EntityType>): Partial<EntityEntity> { /* ... */ }
}
```

### Query Configuration

```typescript
const ENTITY_QUERY_CONFIG: BaseQueryConfig = {
  allowedFilterFields: ['id', 'name', 'status'],
  allowedSortFields: ['id', 'name', 'created'],
  allowedSearchFields: ['id', 'name'],
  defaultSort: { field: 'name', direction: 'ASC' },
  useStrategySearch: true,  // Enable type-aware search
};
```

---

## Testing Patterns

### Unit Test Structure

```typescript
describe('EntityService', () => {
  let service: EntityService;
  let repository: jest.Mocked<IEntityRepository>;
  let logger: jest.Mocked<LoggerService>;

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      findPage: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<IEntityRepository>;

    logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;

    service = new EntityService(repository, logger);
  });

  it('should return entity when found by ID', async () => {
    repository.findById.mockResolvedValue(mockEntity);
    const result = await service.findById('123');
    expect(result).toEqual(mockEntity);
  });
});
```

### What to Test

| Layer | Coverage Target | Focus |
|-------|----------------|-------|
| Services | 90%+ | Business logic, error cases |
| Repositories | 85%+ | Custom query methods |
| Controllers | 80%+ | Request handling, status codes |
| Validators | 90%+ | Custom validation logic |

### What to Exclude

- Simple DTOs, types, interfaces (no logic)
- Entities (unless custom methods)
- Modules (just wiring)
- Migrations

---

## Error Handling

### Exception Types

| Exception | HTTP Status | Use Case |
|-----------|-------------|----------|
| `NotFoundException` | 404 | Entity not found |
| `ConflictException` | 409 | Duplicate key, constraint violation |
| `BadRequestException` | 400 | Invalid input |
| `SearchValidationException` | 400 | Invalid search/filter value |

### i18n Pattern

Always include `i18nType` for client-side localization:

```typescript
throw new NotFoundException({
  message: `Entity with id '${id}' not found`,
  i18nType: 'entity.not_found',
});
```

---

## Naming Conventions

### Files

| Type | Pattern | Example |
|------|---------|---------|
| Entity | `{name}.entity.ts` | `agent.entity.ts` |
| Service | `{name}.service.ts` | `agent.service.ts` |
| Controller | `{name}.controller.ts` | `agent.controller.ts` |
| Repository | `{name}.repository.ts` | `agent.repository.ts` |
| Port | `{name}.repository.port.ts` | `agent.repository.port.ts` |
| DTO | `{action}-{name}.dto.ts` | `create-agent.dto.ts` |
| Test | `{name}.spec.ts` | `agent.service.spec.ts` |

### Database

- **Tables**: `snake_case` (e.g., `agent_mls`, `public_profile`)
- **Columns**: `snake_case` (e.g., `first_name`, `lifecycle_status`)
- **TypeScript properties**: `camelCase` (e.g., `firstName`, `lifecycleStatus`)

### Module Registration

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([EntityEntity, RelatedEntity]),
    PaginationModule,
  ],
  controllers: [EntityController],
  providers: [
    EntityService,
    ProjectionService,
    { provide: 'IEntityRepository', useClass: EntityTypeOrmRepository },
  ],
  exports: [EntityService],
})
export class EntityModule {}
```

---

## Commands

```bash
# Development
pnpm dev                    # Start all services
pnpm build                  # Build all packages and services

# Testing
pnpm test:unit              # Run unit tests
pnpm test:coverage          # Run with coverage
pnpm test:e2e               # Run E2E tests

# Database
pnpm db:create              # Create database
pnpm migration:generate     # Generate migration
pnpm migration:run          # Run migrations

# Linting
pnpm lint                   # Check linting
pnpm lint:fix               # Fix linting issues
```

---

## Role-Specific Instructions

For detailed patterns by role, see:

- [api-architect.instructions.md](.github/instructions/api-architect.instructions.md) - Controllers, interceptors, filters
- [entity-architect.instructions.md](.github/instructions/entity-architect.instructions.md) - TypeORM entities, decorators
- [repository-engineer.instructions.md](.github/instructions/repository-engineer.instructions.md) - Repository pattern, queries
- [test-engineer.instructions.md](.github/instructions/test-engineer.instructions.md) - Jest testing patterns
- [error-handling.instructions.md](.github/instructions/error-handling.instructions.md) - Exception handling
- [query-specialist.instructions.md](.github/instructions/query-specialist.instructions.md) - Search/filter/sort
- [database-architect.instructions.md](.github/instructions/database-architect.instructions.md) - Migrations, indexes
- [metadata-introspection.instructions.md](.github/instructions/metadata-introspection.instructions.md) - Metadata endpoints
