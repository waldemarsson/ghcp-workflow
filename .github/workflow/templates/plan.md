# Plan: <feature>

> Scale detail to complexity: trivial features need only a task or two; non-trivial ones
> get the full task/step breakdown below. Never leave placeholders (no "TBD"/"TODO").

**Goal:** one sentence describing what this builds.

**Architecture:** 2-3 sentences on the approach.

## Global constraints
- Project-wide requirements copied verbatim from spec.md (version floors, naming/copy
  rules, platform/runtime limits). Every task implicitly inherits these.

## File structure
Map every file before defining tasks (one clear responsibility each; follow existing
patterns; files that change together live together):
- `exact/path/to/file` — Create | Modify — responsibility

## Tasks
Each task is the smallest unit with its own test cycle and an independently testable
deliverable.

### Task N: <component>
**Files:**
- Create: `exact/path`
- Modify: `exact/path:line-range`
- Test: `tests/exact/path`

**Interfaces:**
- Consumes: <exact signatures this task uses from earlier tasks>
- Produces: <exact function names / param & return types later tasks rely on>

- [ ] Step 1 — write the failing test (show the actual test code)
- [ ] Step 2 — run it, expect FAIL (exact command + expected message)
- [ ] Step 3 — minimal implementation to pass (show the actual code)
- [ ] Step 4 — run it, expect PASS (exact command)

> Commits are NOT part of plan steps — committing is handled later by the workflow's
> commit phase. End tasks at green tests.

## Tests
- acceptance criterion (from spec) -> the task/test that covers it

## Risks / trade-offs
- ...

## Open questions
- ...
