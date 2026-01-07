# Repository Patterns

This document covers the ports and adapters pattern, base repository implementation, and scoped query patterns.

## Ports and Adapters (Hexagonal Architecture)

```
┌─────────────────────────────────────────────────────────────────┐
│ Application Layer (Service)                                      │
│   - Business logic                                               │
│   - Depends on PORT interface (IAgentRepository)                │
└─────────────────────────────┬───────────────────────────────────┘
                              ↓ depends on
┌─────────────────────────────────────────────────────────────────┐
│ Port Interface (IRepository)                                     │
│   - Abstract contract                                            │
│   - No implementation details                                    │
│   - Defines domain operations                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↑ implemented by
┌─────────────────────────────────────────────────────────────────┐
│ Adapter (TypeORM Repository)                                     │
│   - Concrete implementation                                      │
│   - TypeORM-specific code                                        │
│   - Entity → Domain mapping                                      │
└─────────────────────────────────────────────────────────────────┘
```

## Base Repository Interface

```typescript
// ports/repository.interface.ts
export interface IRepository<TEntity, TId> {
  findById(id: TId): Promise<TEntity | null>;
  findPage(query: QueryParams, selection?: FieldSelection): Promise<PageResult<TEntity>>;
  create(input: CreateInput<TEntity>): Promise<TEntity>;
  update(id: TId, patch: UpdateInput<TEntity>): Promise<TEntity>;
  delete(id: TId): Promise<void>;
}
```

## Domain-Specific Port

```typescript
// modules/agents/ports/agent.repository.port.ts
export interface IAgentRepository extends IRepository<Agent, string> {
  // Domain-specific methods
  findByAgentId(agentId: string): Promise<Agent | null>;
  findByEmail(email: string): Promise<Agent | null>;
  findActiveByOffice(officeId: string, query: QueryParams): Promise<PageResult<Agent>>;
}
```

## TypeORM Adapter Implementation

```typescript
// modules/agents/agent.repository.ts
@Injectable()
export class AgentTypeOrmRepository implements IAgentRepository {
  constructor(
    @InjectRepository(AgentEntity)
    private readonly repo: Repository<AgentEntity>,
    private readonly queryService: QueryService,
    private readonly projectionService: ProjectionService,
  ) {}

  async findById(id: string): Promise<Agent | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.mapToDomain(entity) : null;
  }

  async findPage(query: QueryParams, selection?: FieldSelection): Promise<PageResult<Agent>> {
    const qb = this.repo.createQueryBuilder('agent');

    // Apply projection
    if (selection?.fields) {
      this.projectionService.applyProjection(qb, selection.fields, AGENT_PROJECTION_CONFIG);
    }

    // Apply relations
    if (selection?.relations) {
      this.projectionService.applyRelations(qb, selection.relations, AGENT_PROJECTION_CONFIG);
    }

    // Apply query (search, filter, sort)
    this.queryService.applyQuery(qb, query, AgentEntity);

    // Execute with pagination
    const [entities, total] = await qb
      .skip(query.offset ?? 0)
      .take(query.limit ?? 25)
      .getManyAndCount();

    return {
      items: entities.map(e => this.mapToDomain(e)),
      total,
    };
  }

  async create(input: CreateAgentDto): Promise<Agent> {
    const entity = this.repo.create(input);
    const saved = await this.repo.save(entity);
    return this.mapToDomain(saved);
  }

  async update(id: string, patch: UpdateAgentDto): Promise<Agent> {
    await this.repo.update(id, patch);
    const entity = await this.repo.findOneOrFail({ where: { id } });
    return this.mapToDomain(entity);
  }

  async delete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }

  // Domain-specific methods
  async findByAgentId(agentId: string): Promise<Agent | null> {
    const entity = await this.repo.findOne({ where: { agentId } });
    return entity ? this.mapToDomain(entity) : null;
  }

  async findByEmail(email: string): Promise<Agent | null> {
    const entity = await this.repo.findOne({ where: { email } });
    return entity ? this.mapToDomain(entity) : null;
  }

  private mapToDomain(entity: AgentEntity): Agent {
    return {
      id: entity.id,
      agentId: entity.agentId,
      firstName: entity.firstName,
      lastName: entity.lastName,
      email: entity.email,
      // ... map all fields
    };
  }
}
```

## Module DI Wiring

```typescript
// modules/agents/agent.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([AgentEntity])],
  controllers: [AgentController],
  providers: [
    AgentService,
    {
      provide: 'IAgentRepository',
      useClass: AgentTypeOrmRepository,
    },
  ],
  exports: ['IAgentRepository'],
})
export class AgentModule {}
```

## Service Using Port

```typescript
// modules/agents/agent.service.ts
@Injectable()
export class AgentService {
  constructor(
    @Inject('IAgentRepository')
    private readonly repository: IAgentRepository,
  ) {}

  async create(dto: CreateAgentDto): Promise<Agent> {
    // Business validation
    const existing = await this.repository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException({
        message: 'Agent with this email already exists',
        i18nType: 'agent.email_exists',
      });
    }

    return this.repository.create(dto);
  }
}
```

## Scoped Uniqueness Pattern

When entities require uniqueness within a parent scope (e.g., "name unique per agent"):

```typescript
// Port interface
export interface IContactMethodRepository extends IRepository<ContactMethod, string> {
  findByAgentId(agentId: string, query: QueryParams): Promise<PageResult<ContactMethod>>;

  // Scoped uniqueness - find by parent + unique field
  findByAgentAndName(agentId: string, name: string): Promise<ContactMethod | null>;

  // Business rule support - e.g., "only one primary per channel per agent"
  findPrimaryByAgentAndChannel(agentId: string, channel: string): Promise<ContactMethod | null>;
}

// Repository implementation
async findByAgentAndName(agentId: string, name: string): Promise<ContactMethod | null> {
  const entity = await this.repo.findOne({
    where: { agentId, name },
  });
  return entity ? this.mapToDomain(entity) : null;
}

async findPrimaryByAgentAndChannel(agentId: string, channel: string): Promise<ContactMethod | null> {
  const entity = await this.repo.findOne({
    where: { agentId, channel, isPrimary: true },
  });
  return entity ? this.mapToDomain(entity) : null;
}
```

## Database Constraint (Multi-Layer Defense)

```sql
-- Unique name per agent
CREATE UNIQUE INDEX idx_contact_method_agent_name
  ON contact_method(agent_id, name);

-- Partial unique index: only one primary per channel per agent
CREATE UNIQUE INDEX idx_contact_method_agent_channel_primary
  ON contact_method(agent_id, channel)
  WHERE is_primary = true;
```

## Query Optimization Strategies

### Use DISTINCT ON for "Latest Record" Patterns

```typescript
async findLatestByAgentId(agentId: string): Promise<Event | null> {
  const entity = await this.repo
    .createQueryBuilder('event')
    .distinctOn(['event.agent_id'])
    .where('event.agent_id = :agentId', { agentId })
    .orderBy('event.agent_id')
    .addOrderBy('event.created_at', 'DESC')
    .getOne();

  return entity ? this.mapToDomain(entity) : null;
}
```

### Approximate Count for Large Tables

```typescript
async getApproximateCount(): Promise<number> {
  const result = await this.repo.query(`
    SELECT reltuples::bigint AS estimate
    FROM pg_class
    WHERE relname = 'agents' AND relnamespace = 'core'::regnamespace
  `);
  return result[0]?.estimate ?? 0;
}
```

### Cursor-Based Pagination for Large Datasets

```typescript
async findPageWithCursor(
  cursor: string | null,
  limit: number,
): Promise<{ items: Agent[]; nextCursor: string | null }> {
  const qb = this.repo.createQueryBuilder('agent');

  if (cursor) {
    qb.where('agent.id > :cursor', { cursor });
  }

  qb.orderBy('agent.id', 'ASC').take(limit + 1);

  const entities = await qb.getMany();
  const hasMore = entities.length > limit;

  if (hasMore) {
    entities.pop();
  }

  return {
    items: entities.map(e => this.mapToDomain(e)),
    nextCursor: hasMore ? entities[entities.length - 1].id : null,
  };
}
```

## Critical Rules

1. **Never use COUNT(*) on tables >100K rows** without WHERE clause
2. **Always use column names** (not property names) in raw SQL fragments
3. **Paginate all list endpoints** (offset or cursor)
4. **Use transactions** for multi-step data mutations
5. **Handle database errors** and convert to HTTP exceptions
6. **Never inject repositories from other aggregates** - use guards/services instead

## Testing with Mocked Port

```typescript
describe('AgentService', () => {
  let service: AgentService;
  let repository: jest.Mocked<IAgentRepository>;

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findPage: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<IAgentRepository>;

    service = new AgentService(repository);
  });

  it('should create agent when email is unique', async () => {
    repository.findByEmail.mockResolvedValue(null);
    repository.create.mockResolvedValue({ id: '1', email: 'test@example.com' });

    const result = await service.create({ email: 'test@example.com' });

    expect(result.id).toBe('1');
    expect(repository.findByEmail).toHaveBeenCalledWith('test@example.com');
  });

  it('should throw conflict when email exists', async () => {
    repository.findByEmail.mockResolvedValue({ id: '1', email: 'test@example.com' });

    await expect(service.create({ email: 'test@example.com' }))
      .rejects.toThrow(ConflictException);
  });
});
```
