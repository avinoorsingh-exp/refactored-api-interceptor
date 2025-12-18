```instructions
---
applyTo: "**/*.spec.ts, **/tests/**/*.ts"
---

# Database Testing Instructions

You are an expert in testing TypeORM entities and repositories for the @exprealty/database package.

## Test Structure

### Entity Tests

Entity tests verify decorator metadata, relationships, and column definitions:

```typescript
import { getMetadataArgsStorage } from 'typeorm';
import { AgentEntity } from './agent.entity';

describe('AgentEntity', () => {
  describe('Column Definitions', () => {
    it('should have id as uuid primary key', () => {
      const columns = getMetadataArgsStorage().columns
        .filter(c => c.target === AgentEntity);
      
      const idColumn = columns.find(c => c.propertyName === 'id');
      expect(idColumn).toBeDefined();
    });

    it('should have agent_id column as bigint', () => {
      const columns = getMetadataArgsStorage().columns
        .filter(c => c.target === AgentEntity);
      
      const agentIdColumn = columns.find(c => c.propertyName === 'agentId');
      expect(agentIdColumn?.options?.type).toBe('bigint');
      expect(agentIdColumn?.options?.name).toBe('agent_id');
    });
  });

  describe('Relationships', () => {
    it('should have OneToMany relationship with ContactMethods', () => {
      const relations = getMetadataArgsStorage().relations
        .filter(r => r.target === AgentEntity);
      
      const contactMethodsRelation = relations.find(
        r => r.propertyName === 'contactMethods'
      );
      expect(contactMethodsRelation?.relationType).toBe('one-to-many');
    });
  });
});
```

### Repository Tests

Repository tests verify query building and data access:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

describe('AgentRepository', () => {
  let repository: AgentRepository;
  let mockTypeOrmRepo: jest.Mocked<Repository<AgentEntity>>;

  beforeEach(async () => {
    mockTypeOrmRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentRepository,
        {
          provide: getRepositoryToken(AgentEntity),
          useValue: mockTypeOrmRepo,
        },
        // Mock other dependencies
      ],
    }).compile();

    repository = module.get<AgentRepository>(AgentRepository);
  });

  it('should find agent by id', async () => {
    const mockAgent = { id: 'uuid-123', firstName: 'John' };
    mockTypeOrmRepo.findOne.mockResolvedValue(mockAgent as any);

    const result = await repository.findById('uuid-123');
    
    expect(result).toEqual(mockAgent);
    expect(mockTypeOrmRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'uuid-123' }
    });
  });
});
```

### Migration Tests

Migration tests verify idempotency and rollback:

```typescript
import { DataSource } from 'typeorm';
import { MigrateAgentForeignKeysToUuid1765940000000 } from './1765940000000-MigrateAgentForeignKeysToUuid';

describe('MigrateAgentForeignKeysToUuid', () => {
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  beforeEach(async () => {
    // Use test database
    dataSource = new DataSource({
      type: 'postgres',
      host: 'localhost',
      database: 'test_db',
      synchronize: false,
      dropSchema: true,
    });
    await dataSource.initialize();
    queryRunner = dataSource.createQueryRunner();
  });

  afterEach(async () => {
    await queryRunner.release();
    await dataSource.destroy();
  });

  it('should be idempotent - running twice should not error', async () => {
    const migration = new MigrateAgentForeignKeysToUuid1765940000000();
    
    // First run
    await expect(migration.up(queryRunner)).resolves.not.toThrow();
    
    // Second run - should skip without error
    await expect(migration.up(queryRunner)).resolves.not.toThrow();
  });

  it('should rollback successfully', async () => {
    const migration = new MigrateAgentForeignKeysToUuid1765940000000();
    
    await migration.up(queryRunner);
    await expect(migration.down(queryRunner)).resolves.not.toThrow();
  });
});
```

## Mocking Patterns

### Mock QueryRunner for Migrations

```typescript
const mockQueryRunner = {
  query: jest.fn().mockResolvedValue([]),
  manager: {
    connection: {
      createQueryBuilder: jest.fn(),
    },
  },
} as unknown as QueryRunner;

// Mock column type check
mockQueryRunner.query.mockImplementation((sql: string) => {
  if (sql.includes('information_schema.columns')) {
    return Promise.resolve([{ data_type: 'bigint' }]);
  }
  return Promise.resolve([]);
});
```

### Mock Repository

```typescript
const createMockRepository = <T>(): jest.Mocked<Repository<T>> => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getMany: jest.fn(),
    getManyAndCount: jest.fn(),
  }),
  metadata: {
    columns: [],
    relations: [],
  },
} as unknown as jest.Mocked<Repository<T>>);
```

## Testing Search Decorators

```typescript
import { SearchMetadataReader } from '../decorators/searchable-decorators';

describe('AgentEntity Decorators', () => {
  it('should have searchable fields with correct weights', () => {
    const searchableFields = SearchMetadataReader.getSearchableFields(AgentEntity);
    
    expect(searchableFields).toContainEqual(
      expect.objectContaining({
        propertyName: 'firstName',
        weight: 10,
        behavior: 'partial',
      })
    );
  });

  it('should validate bigint fields', () => {
    const searchableFields = SearchMetadataReader.getSearchableFields(AgentEntity);
    const agentIdField = searchableFields.find(f => f.propertyName === 'agentId');
    
    expect(agentIdField?.validate).toBeDefined();
    expect(() => agentIdField?.validate?.('9999999999999999999999')).toThrow();
    expect(() => agentIdField?.validate?.('12345')).not.toThrow();
  });
});
```

## Foreign Key Consistency Tests

```typescript
describe('Foreign Key Consistency', () => {
  it('should use uuid for agent_id foreign key', () => {
    const columns = getMetadataArgsStorage().columns
      .filter(c => c.target === ActiveLocationEntity);
    
    const agentIdColumn = columns.find(c => c.propertyName === 'agentId');
    expect(agentIdColumn?.options?.type).toBe('uuid');
    expect(agentIdColumn?.options?.type).not.toBe('bigint');
  });

  it('should reference agent.id not agent.agentId', () => {
    const joinColumns = getMetadataArgsStorage().joinColumns
      .filter(j => j.target === ActiveLocationEntity);
    
    const agentJoin = joinColumns.find(j => j.name === 'agent_id');
    
    // Should NOT have referencedColumnName (defaults to PK)
    expect(agentJoin?.referencedColumnName).toBeUndefined();
  });
});
```

## Test Data Factories

```typescript
// test/factories/agent.factory.ts
export const createMockAgent = (overrides?: Partial<AgentEntity>): AgentEntity => ({
  id: 'test-uuid-' + Math.random().toString(36).substr(2, 9),
  agentId: '123456',
  firstName: 'John',
  lastName: 'Doe',
  lifecycleStatus: 'active',
  created: new Date(),
  lastModified: new Date(),
  ...overrides,
} as AgentEntity);
```

## Critical Rules

1. **TEST idempotency** for all migrations
2. **TEST rollback** functionality
3. **MOCK dependencies** - don't hit real database in unit tests
4. **VERIFY decorator metadata** for searchable/filterable fields
5. **CHECK FK types** - ensure uuid is used, not bigint
6. **USE factories** for consistent test data
7. **ISOLATE tests** - each test should be independent
8. **CLEAN UP** - release connections and query runners
9. **TEST edge cases** - null values, empty strings, max values
10. **VALIDATE constraints** - test that validators prevent bad data
```
