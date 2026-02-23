# Docs Spine Sync Skill

This skill governs the consistency of the project's canonical documentation set — the **docs spine**. Any agent that modifies runtime behavior, architectural patterns, or project structure must apply this skill to verify (and correct) alignment across all spine files.

---

## What Is the Docs Spine

The spine is the set of files that together define the single source of truth for the project. They must agree with each other and with the actual code.

| File / Directory | Purpose | Owner |
|---|---|---|
| `docs/ai/context.md` | Session rehydration anchor. Current phase, invariants, completed work, key file references. Overrides chat history. | Updated by any agent after a significant decision |
| `docs/architecture/*.md` | Architectural decisions and patterns. How things work. | Updated when patterns change |
| `docs/runbooks/*.md` | Step-by-step operational procedures. How to do things. | Updated when procedures change |
| `.github/instructions/*.instructions.md` | Role-scoped coding rules applied by IDE assistants. | Updated when coding rules change |
| `.github/agents/*.agent.md` | Subagent definitions: scope, constraints, phase awareness. | Updated when agent roles or scope change |
| `.claude/skills/*/SKILL.md` | Reusable cross-cutting skill definitions. | Updated when skills evolve |

---

## The Spine Must Always Agree On

- **Current phase** — `context.md`, all agent `## Phase Awareness` sections, and the phase-discipline skill must name the same phase
- **Core invariants** — `context.md` invariants must match what `phase-discipline/SKILL.md` declares
- **File locations** — paths referenced in runbooks and instructions must exist and be correct
- **Pattern descriptions** — architecture docs must match what the instructions and agents enforce
- **Agent scope** — an agent's `## Your Scope` must not overlap with another agent's claimed territory in a way that creates ambiguity

---

## Trigger Conditions

Apply this skill (run the sync checklist) whenever:

- A new module, entity, or major feature is completed
- A runbook is created or significantly updated
- A new agent or instruction file is added
- The current phase changes
- A core invariant is added, removed, or clarified
- A file path referenced in any spine doc changes (rename, move, delete)
- An architectural pattern decision is made

---

## Sync Checklist

Work through this checklist in order. Do not skip steps.

### 1. Phase Consistency

```
[ ] docs/ai/context.md → "Current Phase" section names the active phase
[ ] .claude/skills/phase-discipline/SKILL.md → "Current Phase" matches
[ ] Every .github/agents/*.agent.md → "## Phase Awareness" section reflects current phase rules
```

### 2. Invariant Consistency

```
[ ] docs/ai/context.md → "Core Invariants" section is current
[ ] .claude/skills/phase-discipline/SKILL.md → "Core Invariants" section matches
[ ] .github/instructions/*.instructions.md → "Critical rules" sections do not contradict invariants
```

### 3. File Path Validity

```
[ ] Every path referenced in docs/ai/context.md → "Key Files Reference" exists on disk
[ ] Every path referenced in docs/runbooks/*.md exists on disk
[ ] Every path referenced in .github/instructions/*.instructions.md exists on disk
[ ] applyTo: glob patterns in instructions files still match the actual file layout
```

### 4. Architecture ↔ Instructions ↔ Agents Alignment

```
[ ] docs/architecture/api-patterns.md patterns are reflected in:
      .github/instructions/api-architect.instructions.md
      .github/agents/api-layer-architect.agent.md

[ ] docs/architecture/repository-patterns.md patterns are reflected in:
      .github/instructions/repository-engineer.instructions.md
      .github/agents/repository-engineer.agent.md

[ ] docs/architecture/entity-patterns.md patterns are reflected in:
      .github/instructions/entity-architect.instructions.md
      .github/agents/entity-architect.agent.md

[ ] docs/architecture/query-system.md patterns are reflected in:
      .github/instructions/query-specialist.instructions.md
      .github/agents/query-system-specialist.agent.md

[ ] docs/architecture/error-handling.md patterns are reflected in:
      .github/instructions/error-handling.instructions.md
      .github/agents/error-handling-specialist.agent.md
```

### 5. Runbook ↔ Agent Scope Alignment

```
[ ] docs/runbooks/creating-new-module.md steps align with module-generator.agent.md scope
[ ] docs/runbooks/adding-new-route.md steps align with api-layer-architect.agent.md constraints
[ ] docs/runbooks/creating-new-entity.md steps align with entity-architect.agent.md constraints
[ ] docs/runbooks/migration-workflow.md steps align with database-architect.agent.md constraints
[ ] docs/runbooks/bug-fix-workflow.md steps reference correct current file paths
[ ] docs/runbooks/adding-virtual-relation-sorting-filtering.md aligns with query-system-specialist.agent.md
```

### 6. Agent Scope Non-Overlap Check

```
[ ] No two agents claim exclusive ownership of the same file type or directory
[ ] If overlap exists, it is intentional (e.g., module-generator orchestrates other agents)
      and documented in both agents' ## Your Scope sections
```

### 7. Completed Work in context.md

```
[ ] docs/ai/context.md → "Completed Phases" reflects all actually completed work
[ ] Any new pattern, invariant, or decision made in the current session is captured
[ ] "Quick Verification Commands" section still works (commands are current)
```

---

## How to Update Each Spine File

### `docs/ai/context.md`
- Update `Current Phase` if the phase changed
- Append to `Completed Phases` when a major deliverable is done
- Update `Core Invariants` if a new invariant was established or an existing one was clarified
- Update `Key Files Reference` if files were added, renamed, or removed
- Update `Rehydration Instructions` if the reading order for a task type changed

### `docs/architecture/*.md`
- Add a new `## Section` for new patterns
- Update existing sections when a pattern is refined (not replaced wholesale unless phase authorizes)
- Do not delete old patterns without confirming they are no longer used in code

### `docs/runbooks/*.md`
- Update step numbers and commands to reflect the actual current procedure
- Add new steps if the workflow changed
- Mark steps as conditional (`(If X applies...)`) rather than deleting them

### `.github/instructions/*.instructions.md`
- Update `Critical rules` when an invariant changes
- Update code examples when the canonical pattern changes
- Keep `applyTo:` glob accurate

### `.github/agents/*.agent.md`
- Update `## Phase Awareness` when the phase changes
- Update `## Constraints` when a new invariant is established
- Update `## Your Scope` if the agent's responsibility boundary shifts
- Never remove constraints silently — document why if one is relaxed

### `.claude/skills/*/SKILL.md`
- `phase-discipline/SKILL.md`: Update `Current Phase`, `Completed Phases`, and phase rules when the phase changes
- `docs-spine-sync/SKILL.md` (this file): Update the sync checklist if new spine files are added

---

## Drift Patterns to Watch For

These are the most common ways the spine falls out of sync:

| Drift Pattern | How to Detect | How to Fix |
|---|---|---|
| File moved but docs still reference old path | Run checklist step 3 | Update all references in spine docs |
| New pattern added to architecture doc but not reflected in instructions | Run checklist step 4 | Add the pattern to the matching instructions file |
| Phase advanced but phase-discipline skill not updated | Run checklist step 1 | Update `Current Phase` in SKILL.md and all agents |
| Agent created but not registered in context.md key files | Run checklist step 7 | Add to context.md references |
| Runbook references a command that no longer works | Manual verification or CI failure | Update the command in the runbook |
| Two agents claim the same file type | Run checklist step 6 | Clarify ownership in both `## Your Scope` sections |
| New invariant established in a session but not persisted | Session ends, next session violates it | Always write new invariants to context.md before ending session |

---

## Minimal Sync vs. Full Sync

**Minimal sync** (after a bug fix): Run checklist steps 1 and 7 only.

**Full sync** (after a new module, phase change, or new agent): Run all checklist steps.

**Emergency sync** (something is broken and you suspect doc drift): Start from step 3 (file path validity) and work outward.
