```instructions
---
applyTo: "**/entities/**/*.ts, **/migrations/*.ts"
---

# Foreign Key Consistency Instructions

You are enforcing foreign key consistency rules for the @exprealty/database package. This instruction addresses a critical architectural decision about how entities reference the Agent table.

## The Agent Table Dual-ID Pattern

The `agent` table has TWO identifiers:
1. **`id`** (uuid) - The PRIMARY KEY, used for all internal references
2. **`agent_id`** (bigint) - A legacy auto-generated ID for external system compatibility

```typescript
// In agent.entity.ts
@PrimaryGeneratedColumn('uuid')
id!: string  // PRIMARY KEY - use this for FKs

@Column({ name: 'agent_id', type: 'bigint' })
agentId!: string  // LEGACY ID - do NOT use for new FKs
```

## The Rule

**ALL foreign keys referencing agents MUST use `agent.id` (uuid), NOT `agent.agent_id` (bigint).**

### Correct Pattern ✅

```typescript
@Column({ name: 'agent_id', type: 'uuid' })
agentId!: string

@ManyToOne(() => AgentEntity)
@JoinColumn({ name: 'agent_id' })  // References agent.id (uuid) by default
agent?: AgentEntity
```

### Incorrect Pattern ❌

```typescript
// WRONG: Using bigint type
@Column({ name: 'agent_id', type: 'bigint' })
agentId!: string

@ManyToOne(() => AgentEntity)
@JoinColumn({ name: 'agent_id' })  // Type mismatch! Column is bigint, reference is uuid
agent?: AgentEntity
```

### Exception: Artifact Entity

The ONLY exception is `artifact.entity.ts`, which intentionally uses bigint for legacy compatibility:

```typescript
// artifact.entity.ts - LEGACY EXCEPTION, DO NOT COPY
@Column({ name: 'agent_id', type: 'bigint' })
agentId!: string

@ManyToOne('AgentEntity')
@JoinColumn({ name: 'agent_id', referencedColumnName: 'agentId' })  // Explicitly references agentId (bigint)
agent?: unknown
```

## Entities That MUST Use UUID

All of these entities correctly use UUID for `agent_id`:
- `AgentAddressEntity`
- `AgentMLSEntity`
- `AgentOfficeEntity`
- `AgentExternalReferenceEntity`
- `AgentLanguageEntity`
- `PaymentSettingsEntity`
- `ContactMethodEntity`
- `EmailForwardEntity`
- `PublicProfileEntity`
- `RelationshipEntity`
- `ActiveLocationEntity` *(migrated from bigint)*
- `SponsorConfigurationEntity` *(migrated from bigint)*

## How to Identify Violations

Search for entities using bigint agent_id foreign keys:

```bash
# Find potential violations
grep -r "agent_id.*bigint" packages/database/src/entities/

# Verify JoinColumn references
grep -A2 "@JoinColumn.*agent_id" packages/database/src/entities/
```

## How to Fix Violations

1. **Update the entity** to use `type: 'uuid'`
2. **Create an idempotent migration** that:
   - Adds temporary UUID column
   - Populates from `agent.id` via `agent.agent_id` mapping
   - Drops old bigint column
   - Renames temp column
   - Recreates constraints with UUID type

See `1765940000000-MigrateAgentForeignKeysToUuid.ts` for a complete example.

## Why This Matters

1. **Type Safety**: UUID ↔ UUID joins are type-safe; bigint → uuid joins cause runtime errors
2. **Referential Integrity**: FK constraints require matching column types
3. **Query Performance**: UUID primary key has indexes; bigint agent_id has separate index
4. **Future Proofing**: The legacy bigint may be deprecated; UUID is the canonical identifier

## Checklist for New Entities

When creating an entity that references Agent:

- [ ] Column type is `uuid`, not `bigint`
- [ ] Column name follows convention: `agent_id`
- [ ] JoinColumn references primary key (default behavior)
- [ ] No `referencedColumnName` specified (unless intentional legacy reference)
- [ ] Cascade behavior is appropriate (CASCADE for dependent entities)

## Checklist for Code Review

When reviewing entity changes:

- [ ] Any `agent_id` column uses `type: 'uuid'`
- [ ] JoinColumn does NOT specify `referencedColumnName: 'agentId'` (unless artifact)
- [ ] Migration is created for schema changes
- [ ] Migration is idempotent
- [ ] Migration has working rollback
```
