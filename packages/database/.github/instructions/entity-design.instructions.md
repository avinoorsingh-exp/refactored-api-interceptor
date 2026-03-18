```instructions
---
applyTo: "**/entities/**/*.ts"
---

# Entity Design Instructions

You are an expert in TypeORM entity design for the @exprealty/database package. This package provides the persistence layer for all domain entities in the eXpRealty platform.

## Core Principles

### Primary Key Strategy
- Use `uuid` as the primary key type for all new entities: `@PrimaryGeneratedColumn('uuid')`
- Legacy bigint IDs (like `agent.agent_id`) are for backward compatibility ONLY
- NEVER use legacy bigint IDs as foreign keys in new entities

### Foreign Key Consistency
- **CRITICAL**: All foreign keys referencing `agent` MUST use `agent.id` (UUID), NOT `agent.agent_id` (bigint)
- The pattern `@JoinColumn({ name: 'agent_id' })` defaults to referencing the primary key (`id`, uuid)
- Only `artifact.entity.ts` uses `referencedColumnName: 'agentId'` for legacy compatibility

**Correct Pattern (UUID foreign key):**
```typescript
@Column({ name: 'agent_id', type: 'uuid' })
agentId!: string

@ManyToOne(() => AgentEntity)
@JoinColumn({ name: 'agent_id' })
agent?: AgentEntity
```

**Incorrect Pattern (DO NOT USE for new entities):**
```typescript
// WRONG: Using bigint for agent_id foreign key
@Column({ name: 'agent_id', type: 'bigint' })
agentId!: string
```

### Column Naming
- Always specify `name` for multi-word properties: `@Column({ name: 'first_name', type: 'text' })`
- Database columns use `snake_case`
- TypeScript properties use `camelCase`
- TypeORM automatically maps between them when `name` is specified

### Type Mappings
| Domain Type | PostgreSQL Type | TypeScript Type | Notes |
|-------------|-----------------|-----------------|-------|
| UUID | `uuid` | `string` | Primary keys, foreign keys |
| Legacy ID | `bigint` | `string` | Only for `agent.agentId` compatibility |
| Integer | `integer` | `number` | Small numbers (< 2.1B) |
| Text | `text` | `string` | Variable-length strings |
| Boolean | `boolean` | `boolean` | |
| Date/Time | `timestamp with time zone` | `Date` | Always use timezone |
| Date only | `date` | `string` | ISO 8601 format (YYYY-MM-DD) |

## Decorator Patterns

### Searchable Fields
Apply `@Searchable` for fields that should be searchable via the `search` query parameter:

```typescript
@Column({ name: 'first_name', type: 'text' })
@Searchable({ 
  weight: 10,           // Higher = more relevant (1-10 scale)
  behavior: 'partial',  // 'partial' | 'exact'
  description: 'Agent first/given name'
})
firstName!: string
```

### Numeric Field Validation
Always add validators for numeric fields to prevent PostgreSQL overflow:

```typescript
@Column({ name: 'agent_id', type: 'bigint' })
@Searchable({ 
  type: 'integer', 
  weight: 4, 
  behavior: 'exact',
  validate: SearchValidators.bigint  // Prevents overflow errors
})
agentId!: string
```

### Filterable and Sortable
```typescript
@Column({ type: 'text' })
@Searchable({ weight: 5, behavior: 'exact', description: 'Lifecycle status' })
@Filterable()  // Enables ?filter=status:eq:active
@Sortable()    // Enables ?sort=status:asc
lifecycleStatus!: string
```

## Relationship Patterns

### One-to-Many (Parent side)
```typescript
@OneToMany('ChildEntity', 'parent')
children?: ChildEntity[]
```

### Many-to-One (Child side with UUID FK)
```typescript
@Column({ name: 'parent_id', type: 'uuid' })
parentId!: string

@ManyToOne(() => ParentEntity)
@JoinColumn({ name: 'parent_id' })
parent?: ParentEntity
```

### Many-to-Many (Junction table)
```typescript
@Entity({ name: 'entity_other', schema: 'core' })
export class EntityOtherEntity {
  @PrimaryColumn({ name: 'entity_id', type: 'uuid' })
  entityId!: string

  @PrimaryColumn({ name: 'other_id', type: 'uuid' })
  otherId!: string

  @ManyToOne(() => EntityEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entity_id' })
  entity?: EntityEntity

  @ManyToOne(() => OtherEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'other_id' })
  other?: OtherEntity
}
```

## Base Classes

### AuditableEntity
Extend for entities requiring audit trail:
```typescript
@Entity({ name: 'my_entity', schema: 'core' })
export class MyEntity extends AuditableEntity {
  // Inherits: created, lastModified, modifiedBy
}
```

## Critical Rules

1. **NEVER use `synchronize: true`** - Always use migrations for schema changes
2. **NEVER use bigint for new foreign keys** - Use UUID referencing the primary key
3. **ALWAYS specify column names** for multi-word properties
4. **ALWAYS add JSDoc comments** for public properties and the class itself
5. **ALWAYS include `@public` tags** for API documentation
6. **VALIDATE numeric fields** to prevent PostgreSQL overflow (bigint, integer)
7. **USE `timestamp with time zone`** for all datetime columns
8. **CONSIDER cascade behavior** on foreign keys (CASCADE, SET NULL, NO ACTION)
```
