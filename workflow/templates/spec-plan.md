# <Feature title> — spec + plan (Quick track)

> Quick-track features merge the spec and the plan into this **one** artifact with a
> **single gate** (`approve`, or `approve plan`). Keep it lean — a Quick feature is small,
> localized, and low-risk. Never leave placeholders (no "TBD"/"TODO"). If the work turns out
> to need real architectural decisions, switch to Standard
> (`node ~/.copilot/extensions/workflow-gate/store.mjs set track standard --slug <slug>`) and
> split into separate `spec.md` + `plan.md`.

## Spec

**Problem / why:** 1-2 sentences on the motivation.

**Scope (in):**
- ...

**Out of scope:**
- ...

**Chosen approach:** the agreed approach + 1 line on why.

**Constraints:** project-wide requirements (version floors, naming/copy rules,
platform/runtime limits) — the tasks below inherit these.
- ...

**Acceptance criteria:**
- [ ] AC1: testable criterion
- [ ] AC2: testable criterion

**Edge cases:**
- ...

## Plan

**Architecture:** 1-2 sentences on the approach (often trivial for a Quick change).

### File structure
Map every file before the tasks (one clear responsibility each; follow existing patterns):
- `exact/path/to/file` — Create | Modify — responsibility

### Public contracts (keep stable across tasks)
Only the signatures/types later tasks depend on — names, params, return types. NOT
implementations. (Omit this section when there are none — common for Quick.)
- `module/path` — `functionName(args): ReturnType` — one-line behavior

### Tasks
Each task is an independently testable deliverable (Quick features are often a single task).
Describe the deliverable and the behaviors to test — not the code itself.

#### T1: <component>
**Files:** Create | Modify — `exact/path`

**Deliverable:** what works when this task is done.

**Contract (if any):** exact public names/types this task exposes for later tasks (omit if none).

**Behaviors to cover with tests:** the cases the implementer must test (happy path, edge
cases, error handling) — described as behavior, not test code.

**Gate:** the exact command(s) to run and the expected outcome (e.g. `npm test` green).

> Commits are NOT plan steps — committing is handled later by the workflow's commit phase.

### Tests
- AC1 -> T1 / test behavior that covers it
- AC2 -> T1 / test behavior that covers it

### Risks / trade-offs
- ...

## Open questions
- None
