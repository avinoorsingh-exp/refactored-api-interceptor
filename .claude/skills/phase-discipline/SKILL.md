# Phase Discipline Skill

**Every subagent must internalize this skill before touching a single file.**
This is the cross-cutting enforcement layer. It defines what phase we are in, what that means for each change type, and how to detect and prevent cross-phase leakage.

---

## Current Phase

**Stabilization — Testing & Bug Fixes**

The system architecture is complete. Schemas, entities, migrations, query system, repository patterns, and API layer are all established. The work now is verification, correctness, and alignment — not expansion.

---

## Completed Phases (Do Not Reopen)

These phases are sealed. Do not modify decisions made in them unless a bug is confirmed.

- Initial schema design and entity creation
- Agent, Company, Office, Address, and related entities
- Many-to-many relationships (AgentOffice, AgentAddress, AgentMLS)
- Query system with search, filter, sort, and projection
- Error handling with RFC 9457 Problem Details
- Migration workflow with idempotent migrations

---

## Stabilization Rules (Active Now)

| Rule | What It Means |
|---|---|
| No new features without explicit approval | Adding a new endpoint, entity, or module is blocked unless the task explicitly authorizes it |
| Minimal diffs preferred | Fix the one broken thing. Do not refactor surrounding code. Do not add helpers for one-off tasks. |
| Update runbooks when changing runtime behavior | If a fix changes how something works (query params, response shape, validation), update the relevant runbook in the same changeset |
| Keep CI policy checks green | Never check in code that fails linting, type checks, or unit tests |
| Fix bugs and align docs before adding scope | If docs are stale or a test is missing, fix those before touching new functionality |

---

## No Cross-Phase Leakage — Enforcement Rules

Cross-phase leakage is when work from a future phase bleeds into stabilization work. It is the primary discipline failure.

### What Constitutes Leakage

**Leakage FROM future phases into current work:**
- Adding a new entity while fixing a query bug
- Creating a new module while updating a DTO
- Refactoring a service while adding a test
- Adding a new API endpoint while correcting a validation error
- Introducing a new design pattern while resolving a 500 error

**Leakage FROM past phases (reopening sealed decisions):**
- Changing the Base/Expanded schema pattern because you prefer a different approach
- Switching from ports/adapters to direct repository injection
- Altering completed migration files
- Changing the RFC 9457 Problem Details format
- Removing `i18nType` from exceptions because "it's unused"

### Pre-Flight Checklist (Run Before Every Change)

Before writing a single line of code, answer these five questions:

```
[ ] 1. Is this change fixing a specific, identified bug — or is it "improvement"?
        If improvement → STOP. Log the idea. Do not implement without approval.

[ ] 2. Does this change touch only the files directly related to the stated task?
        If touching unrelated files → STOP. Scope back.

[ ] 3. Does this change reverse or alter a completed-phase decision?
        If yes → STOP. The decision is sealed unless a bug is confirmed.

[ ] 4. Will this change require updating docs/ai/context.md or a runbook?
        If yes → include those updates in the SAME changeset.

[ ] 5. Does this change introduce any new dependency, package, or architectural pattern?
        If yes → STOP. New dependencies require explicit approval in stabilization.
```

---

## What Is Always Permitted in Stabilization

No approval required:

- Bug fixes with a minimal diff
- Adding or improving tests for existing behavior
- Fixing a doc that is factually wrong
- Aligning a runbook to match actual current behavior
- Fixing a type error without changing runtime behavior
- Correcting a migration that has not yet been applied to production
- Improving error messages (more specific, not format-breaking)

---

## What Requires Explicit Approval

Blocked until a human explicitly authorizes:

- Any new entity or migration for a new entity
- Any new module (full or partial)
- Any new API endpoint on an existing controller
- Any new package dependency
- Any change to the Base/Expanded schema contract
- Any change to the RFC 9457 Problem Details response format
- Any change to the ports/adapters pattern
- Any architectural refactor

---

## Core Invariants (Non-Negotiable, All Phases)

These rules apply in every phase.

### Database
- **NEVER** `synchronize: true` — always use migrations
- **NEVER** bigint for new FKs referencing `agent` — use UUID referencing `agent.id`
- **ALWAYS** make migrations idempotent — check state before modifying
- **ALWAYS** implement `down()` for rollback

### API
- **ALWAYS** `ZodValidationPipe` for request body validation
- **ALWAYS** `i18nType` in custom exceptions for localization
- **ALWAYS** `PaginationInterceptor` for list endpoints
- **NEVER** expose stack traces in production responses

### Architecture
- Services depend on PORT interfaces — never on concrete repository classes
- Repositories implement ports — adapters pattern only
- Entity → Domain mapping happens in the repository adapter — not in the service
- Domain types are pure — no NestJS or TypeORM imports

### Relationships
- Use string entity names for relationship decorators to avoid circular imports
- Always define FK column separately from the relationship decorator
- Always specify `onDelete` behavior explicitly

---

## Escalation Protocol

If you are unsure whether a change is in scope:

1. Do not implement it speculatively
2. State what you would do and why you are uncertain
3. Wait for the human to authorize or redirect
4. Document the decision so `docs/ai/context.md` can be updated if approved

**When in doubt, do less. A smaller correct diff is always better than a larger uncertain one.**
