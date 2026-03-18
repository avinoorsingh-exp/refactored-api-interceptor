```instructions
---
applyTo: "**/entities/**/*.ts"
---

# Relationship Design Instructions

You are an expert in TypeORM relationship design for the @exprealty/database package. This instruction covers proper relationship patterns, cascade behavior, and circular dependency handling.

## Relationship Types

### One-to-Many / Many-to-One

The most common pattern: Parent has many Children, Child belongs to Parent.

**Parent Entity:**
```typescript
@Entity({ name: 'agent', schema: 'core' })
export class AgentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  // Use string name to avoid circular dependency
  @OneToMany('ContactMethodEntity', 'agent')
  contactMethods?: ContactMethodEntity[]
}
```

**Child Entity:**
```typescript
@Entity({ name: 'contact_method', schema: 'core' })
export class ContactMethodEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number

  @Column({ name: 'agent_id', type: 'uuid' })
  agentId!: string

  @ManyToOne(() => AgentEntity)
  @JoinColumn({ name: 'agent_id' })
  agent?: AgentEntity
}
```

### Many-to-Many (Junction Table)

For many-to-many relationships, always create an explicit junction entity:

```typescript
@Entity({ name: 'agent_language', schema: 'core' })
export class AgentLanguageEntity {
  @PrimaryColumn({ name: 'agent_id', type: 'uuid' })
  agentId!: string

  @PrimaryColumn({ name: 'language_id', type: 'uuid' })
  languageId!: string

  @ManyToOne(() => AgentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent?: AgentEntity

  @ManyToOne(() => LanguageEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'language_id' })
  language?: LanguageEntity
}
```

### One-to-One

```typescript
@Entity({ name: 'agent', schema: 'core' })
export class AgentEntity {
  @OneToOne('PublicProfileEntity', 'agent')
  publicProfile?: PublicProfileEntity
}

@Entity({ name: 'public_profile', schema: 'core' })
export class PublicProfileEntity {
  @Column({ name: 'agent_id', type: 'uuid' })
  agentId!: string

  @OneToOne(() => AgentEntity)
  @JoinColumn({ name: 'agent_id' })
  agent?: AgentEntity
}
```

## Circular Dependency Handling

### Problem
TypeScript circular imports cause `undefined` class references.

### Solution: String Names
Use string names instead of class references for forward declarations:

```typescript
// CORRECT ✅ - Use string for entity name
@OneToMany('ContactMethodEntity', 'agent')
contactMethods?: ContactMethodEntity[]

@ManyToOne('AgentEntity')
@JoinColumn({ name: 'agent_id' })
agent?: unknown  // Use unknown type when class not imported
```

### Import Type Declarations
```typescript
// At top of file
import type { ContactMethodEntity } from './contact-method.entity.js'

// In decorator - use string
@OneToMany('ContactMethodEntity', 'agent')
contactMethods?: ContactMethodEntity[]  // Type-only import for typing
```

## Cascade Behavior

### OnDelete Options

| Option | Behavior | Use Case |
|--------|----------|----------|
| `CASCADE` | Delete children when parent deleted | Dependent data (addresses, contacts) |
| `SET NULL` | Set FK to null when parent deleted | Optional relationships |
| `NO ACTION` | Prevent deletion if children exist | Enforce referential integrity |
| `RESTRICT` | Same as NO ACTION (standard SQL) | Enforce referential integrity |

### Cascade Examples

```typescript
// CASCADE - Delete contact methods when agent is deleted
@ManyToOne(() => AgentEntity, { onDelete: 'CASCADE' })
@JoinColumn({ name: 'agent_id' })
agent?: AgentEntity

// SET NULL - Set office_id to null when office deleted
@ManyToOne(() => OfficeEntity, { onDelete: 'SET NULL' })
@JoinColumn({ name: 'office_id' })
office?: OfficeEntity

// NO ACTION - Prevent deletion if relationships exist
@ManyToOne(() => PayPlanEntity, { onDelete: 'NO ACTION' })
@JoinColumn({ name: 'pay_plan_id' })
payPlan?: PayPlanEntity
```

### TypeORM Cascade (Application-Level)

For application-level cascading (not database-level):

```typescript
// Cascade insert/update from parent to children
@OneToMany('ContactMethodEntity', 'agent', { cascade: true })
contactMethods?: ContactMethodEntity[]

// Specific cascade operations
@OneToMany('AddressEntity', 'agent', { 
  cascade: ['insert', 'update']  // But not 'remove'
})
addresses?: AddressEntity[]
```

## Eager vs Lazy Loading

### Eager Loading (Default: Off)
```typescript
// Load relationship automatically with parent
@ManyToOne(() => AgentEntity, { eager: true })
agent?: AgentEntity
```

**Caution:** Eager loading can cause N+1 queries. Use sparingly.

### Lazy Loading
```typescript
// Load on access (requires Promise)
@ManyToOne(() => AgentEntity, { lazy: true })
agent?: Promise<AgentEntity>
```

### Recommended: Explicit Loading
Use query builder with explicit joins:

```typescript
// In repository
const agent = await this.repo
  .createQueryBuilder('agent')
  .leftJoinAndSelect('agent.contactMethods', 'cm')
  .where('agent.id = :id', { id })
  .getOne();
```

## Self-Referencing Relationships

For hierarchies (sponsor → agent):

```typescript
@Entity({ name: 'relationship', schema: 'core' })
export class RelationshipEntity {
  @PrimaryColumn({ name: 'subject_agent_id', type: 'uuid' })
  subjectAgentId!: string

  @PrimaryColumn({ name: 'object_agent_id', type: 'uuid' })
  objectAgentId!: string

  @Column({ type: 'text' })
  type!: 'sponsor_primary' | 'sponsor_successor' | 'mentor'

  @ManyToOne(() => AgentEntity)
  @JoinColumn({ name: 'subject_agent_id' })
  subjectAgent?: AgentEntity

  @ManyToOne(() => AgentEntity)
  @JoinColumn({ name: 'object_agent_id' })
  objectAgent?: AgentEntity
}
```

## Nullable Foreign Keys

```typescript
// Optional relationship (FK can be null)
@Column({ name: 'office_id', type: 'uuid', nullable: true })
officeId?: string

@ManyToOne(() => OfficeEntity, { nullable: true })
@JoinColumn({ name: 'office_id' })
office?: OfficeEntity
```

## Critical Rules

1. **ALWAYS define FK column** separately from relationship
2. **USE uuid type** for all new foreign keys to Agent
3. **USE string names** for circular dependencies
4. **SPECIFY onDelete** behavior explicitly
5. **AVOID eager loading** unless absolutely necessary
6. **USE CASCADE carefully** - understand deletion implications
7. **CREATE junction entities** for many-to-many relationships
8. **NULLABLE FK** requires `nullable: true` on both column and relationship
9. **TYPE safety** - use `unknown` when avoiding circular imports
10. **DOCUMENT relationships** with JSDoc comments
```
