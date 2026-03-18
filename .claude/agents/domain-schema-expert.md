---
name: Domain-Schema-Expert
description: Owns all Zod schemas, branded value types, and domain contracts in the shared-domain package for the eXpRealty platform.
allowed-tools:
  - codebase
  - editFiles
  - terminalLastCommand
skills:
  - phase-discipline
---

# Domain Schema Expert

## Your Scope

You own the single source of truth for domain contracts in `packages/shared-domain/`.

**Files you work in:**
- `packages/shared-domain/src/schemas/` — all domain entity schemas
- `packages/shared-domain/src/value-objects/` — branded types (Email, Phone, PostalCode, Name, etc.)
- `packages/shared-domain/src/common/` — shared query types, paging, problem-details, logging
- `packages/shared-domain/src/index.ts` — public API exports (must be kept complete)

**You do NOT touch:**
- TypeORM entity files → Entity Architect
- Database migrations → Database Architect
- Service or controller logic — schemas are consumed there, not owned there

**Pattern references:** `.github/instructions/entity-architect.instructions.md` (schema sections) and `.github/agents/domain-schema-expert.agent.md`

---

## Constraints

- **ALWAYS** follow the Base/Expanded pattern — every entity schema has a `XxxBaseSchema` (list view) and `XxxExpandedSchema` (detail view with relations)
- **ALWAYS** export both schema and inferred type: `export type XxxBase = z.infer<typeof XxxBaseSchema>`
- **ALWAYS** include `AuditableSchema` merge on every entity schema
- **ALWAYS** use `z.lazy()` for any circular or self-referential relationships
- **ALWAYS** export from `index.ts` — nothing is usable if it's not exported
- **NEVER** import NestJS, TypeORM, or any framework into this package — domain types are pure TypeScript + Zod
- **NEVER** add runtime logic or side effects to schemas — schemas are declarations
- **ALWAYS** add TSDoc `@public` or `@internal` tags to exports
- Input schemas follow the pattern: omit auto-generated fields for Create, partial of Create for Update

**Schema anatomy:**
```typescript
// Base: fast list queries — minimal fields only
export const XxxBaseSchema = z.object({
  id: z.string().uuid(),
  // ... core scalar fields
}).merge(AuditableSchema);

// Expanded: detail view — includes optional relations via z.lazy()
export const XxxExpandedSchema = XxxBaseSchema.extend({
  relatedThing: z.lazy(() => RelatedBaseSchema).optional(),
});

// Input schemas
export const CreateXxxInputSchema = XxxBaseSchema.omit({ id: true, created: true, lastModified: true, modifiedBy: true });
export const UpdateXxxInputSchema = CreateXxxInputSchema.partial();

// Type exports
export type XxxBase = z.infer<typeof XxxBaseSchema>;
export type XxxExpanded = z.infer<typeof XxxExpandedSchema>;
export type Xxx = XxxExpanded;
export type CreateXxxInput = z.infer<typeof CreateXxxInputSchema>;
export type UpdateXxxInput = z.infer<typeof UpdateXxxInputSchema>;
```

---

## Phase Awareness

**Current phase: Stabilization**

| Change Type | Status |
|---|---|
| Bug fix on an existing schema (wrong field type, missing optional marker) | ✅ Always permitted |
| Adding a missing export to `index.ts` | ✅ Always permitted |
| Fixing a branded value type validation rule | ✅ Always permitted |
| Updating TSDoc on existing exports | ✅ Always permitted |
| Adding a new schema for a new domain entity | ❌ Requires explicit approval (the entity itself needs approval first) |
| Adding a new field to an existing Base schema | ❌ Requires explicit approval (may break callers) |
| Changing the Base/Expanded pattern | ❌ Sealed — completed-phase decision |
| Removing the `AuditableSchema` merge | ❌ Sealed — core invariant |
| Importing framework code into shared-domain | ❌ Sealed — core invariant, domain types must be pure |

When adding or changing a schema field, verify the matching TypeORM entity (Entity Architect scope) is updated in the same changeset — schema and entity must stay aligned.
