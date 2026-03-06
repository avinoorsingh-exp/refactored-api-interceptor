# Entity Design Patterns

This document covers TypeORM entity design, decorators, relationships, and database schema patterns.

## Core Principles

### Primary Key Strategy

```typescript
// NEW entities: Always use UUID
@PrimaryGeneratedColumn('uuid')
id!: string;

// LEGACY entities: bigint for backward compatibility ONLY
@Column({ name: 'agent_id', type: 'bigint' })
agentId!: string;  // Legacy ID for external systems
```

### Foreign Key Consistency

**Critical Rule**: All foreign keys referencing `agent` MUST use `agent.id` (UUID), NOT `agent.agent_id` (bigint).

```typescript
// CORRECT - UUID foreign key
@Column({ name: 'agent_id', type: 'uuid' })
agentId!: string;

@ManyToOne(() => AgentEntity)
@JoinColumn({ name: 'agent_id' })  // References agent.id (uuid) by default
agent?: AgentEntity;

// INCORRECT - DO NOT USE for new entities
@Column({ name: 'agent_id', type: 'bigint' })  // WRONG
agentId!: string;
```

### Column Naming

```typescript
// TypeScript: camelCase
// Database: snake_case
// Always specify name for multi-word properties

@Column({ name: 'first_name', type: 'text' })
firstName!: string;

@Column({ name: 'lifecycle_status', type: 'text' })
lifecycleStatus!: string;
```

## Type Mappings

| Domain Type | PostgreSQL Type | TypeScript Type | Notes |
|-------------|-----------------|-----------------|-------|
| UUID | `uuid` | `string` | Primary keys, foreign keys |
| Legacy ID | `bigint` | `string` | Only for backward compatibility |
| Integer | `integer` | `number` | Small numbers (< 2.1B) |
| Text | `text` | `string` | Variable-length strings |
| Boolean | `boolean` | `boolean` | |
| Date/Time | `timestamp with time zone` | `Date` | Always use timezone |
| Date only | `date` | `string` | ISO 8601 format (YYYY-MM-DD) |
| Money | `numeric(12,2)` | `string` | Use string to avoid precision loss |

## Search Decorators

### @Searchable

```typescript
@Column({ name: 'first_name', type: 'text' })
@Searchable({
  weight: 10,           // Relevance weight 1-10 (higher = more relevant)
  behavior: 'partial',  // 'partial' | 'exact' | 'prefix' | 'suffix'
  description: 'Agent first name',
  validate: undefined,  // Optional validator function
})
firstName!: string;
```

### Weight Guidelines

| Weight | Use Case | Example Fields |
|--------|----------|----------------|
| 10 | Primary identifiers, names | firstName, lastName |
| 8-9 | Secondary identifiers | email, preferredName |
| 6-7 | Important text fields | bio, company name |
| 4-5 | Reference IDs | agentId, officeId |
| 2-3 | Metadata fields | status, type |
| 1 | Low-priority fields | internal codes |

### Numeric Field Validation

Always add validators for numeric fields to prevent PostgreSQL overflow:

```typescript
@Column({ name: 'agent_id', type: 'bigint' })
@Searchable({
  type: 'integer',
  weight: 4,
  behavior: 'exact',
  description: 'Agent ID (bigint)',
  validate: SearchValidators.bigint,  // Validates ±9.2 quintillion range
})
agentId!: string;

@Column({ type: 'integer' })
@Searchable({
  type: 'integer',
  weight: 3,
  behavior: 'exact',
  validate: SearchValidators.integer,  // Validates ±2.1 billion range
})
count!: number;
```

### @Filterable and @Sortable

```typescript
@Column({ type: 'text' })
@Searchable({ weight: 5, behavior: 'exact', description: 'Lifecycle status' })
@Filterable()  // Enables ?filter={"lifecycleStatus":{"eq":"active"}}
@Sortable()    // Enables ?sort=["lifecycleStatus:asc"]
lifecycleStatus!: string;
```

## Relationship Patterns

### One-to-Many / Many-to-One

```typescript
// Parent Entity (Agent)
@Entity({ name: 'agent', schema: 'core' })
export class AgentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Use string name to avoid circular dependency
  @OneToMany('ContactMethodEntity', 'agent')
  contactMethods?: ContactMethodEntity[];
}

// Child Entity (ContactMethod)
@Entity({ name: 'contact_method', schema: 'core' })
export class ContactMethodEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'agent_id', type: 'uuid' })
  agentId!: string;

  @ManyToOne(() => AgentEntity)
  @JoinColumn({ name: 'agent_id' })
  agent?: AgentEntity;
}
```

### Many-to-Many (Junction Table)

```typescript
@Entity({ name: 'agent_language', schema: 'core' })
export class AgentLanguageEntity {
  @PrimaryColumn({ name: 'agent_id', type: 'uuid' })
  agentId!: string;

  @PrimaryColumn({ name: 'language_id', type: 'uuid' })
  languageId!: string;

  // Additional metadata on junction
  @Column({ name: 'proficiency', type: 'text', nullable: true })
  proficiency?: string;

  @ManyToOne(() => AgentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent?: AgentEntity;

  @ManyToOne(() => LanguageEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'language_id' })
  language?: LanguageEntity;
}
```

### One-to-One

```typescript
// Parent (Agent)
@Entity({ name: 'agent', schema: 'core' })
export class AgentEntity {
  @OneToOne('PublicProfileEntity', 'agent')
  publicProfile?: PublicProfileEntity;
}

// Child (PublicProfile)
@Entity({ name: 'public_profile', schema: 'core' })
export class PublicProfileEntity {
  @Column({ name: 'agent_id', type: 'uuid' })
  agentId!: string;

  @OneToOne(() => AgentEntity)
  @JoinColumn({ name: 'agent_id' })
  agent?: AgentEntity;
}
```

## Cascade Behavior

### OnDelete Options

| Option | Behavior | Use Case |
|--------|----------|----------|
| `CASCADE` | Delete children when parent deleted | Dependent data (addresses, contacts) |
| `SET NULL` | Set FK to null when parent deleted | Optional relationships |
| `NO ACTION` | Prevent deletion if children exist | Enforce referential integrity |

```typescript
// CASCADE - Delete contact methods when agent is deleted
@ManyToOne(() => AgentEntity, { onDelete: 'CASCADE' })
@JoinColumn({ name: 'agent_id' })
agent?: AgentEntity;

// SET NULL - Set office_id to null when office deleted
@ManyToOne(() => OfficeEntity, { onDelete: 'SET NULL' })
@JoinColumn({ name: 'office_id' })
office?: OfficeEntity;
```

## Circular Dependency Handling

Use string names instead of class references:

```typescript
// CORRECT - Use string for entity name
@OneToMany('ContactMethodEntity', 'agent')
contactMethods?: ContactMethodEntity[];

@ManyToOne('AgentEntity')
@JoinColumn({ name: 'agent_id' })
agent?: unknown;  // Use unknown when class not imported
```

## Base Classes

### AuditableEntity

```typescript
@Entity({ name: 'my_entity', schema: 'core' })
export class MyEntity extends AuditableEntity {
  // Inherits: createdAt, createdBy, updatedAt, updatedBy, deletedAt
}
```

## Entity Checklist

When creating a new entity:

- [ ] Column type is `uuid` for new foreign keys (not bigint)
- [ ] Column name follows snake_case convention
- [ ] TypeScript property uses camelCase
- [ ] `@Column({ name: '...' })` specified for multi-word properties
- [ ] Searchable fields have `@Searchable` with appropriate weight
- [ ] Numeric fields have validation (bigint, integer, range)
- [ ] Relationships use string names to avoid circular imports
- [ ] Cascade behavior explicitly specified
- [ ] JSDoc comments for documentation
- [ ] Entity registered in DataSource entities array

## Code Review Checklist

- [ ] Any `agent_id` column uses `type: 'uuid'`
- [ ] JoinColumn does NOT specify `referencedColumnName: 'agentId'` (unless legacy artifact)
- [ ] Migration is created for schema changes
- [ ] Migration is idempotent
- [ ] Migration has working rollback
