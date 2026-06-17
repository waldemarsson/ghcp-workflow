# Plan: <feature>

> This plan is a **guide/contract, not a code dump.** Define *what* to build and the
> contracts other tasks depend on; leave *how* (the actual implementation and test code) to
> the implementer, who is the code expert. Scale detail to complexity: trivial features need
> only a task or two. Never leave placeholders (no "TBD"/"TODO").

**Goal:** one sentence describing what this builds.

**Architecture:** 2-3 sentences on the approach.

> **For the implementer:** the signatures and behaviors below are the contract — keep the
> public names/types stable so tasks compose, but you own the implementation details and the
> tests. Work TDD-style and run each task's gate before moving on.

## Global constraints
- Project-wide requirements copied verbatim from spec.md (version floors, naming/copy
  rules, platform/runtime limits). Every task implicitly inherits these.

## File structure
Map every file before defining tasks (one clear responsibility each; follow existing
patterns; files that change together live together):
- `exact/path/to/file` — Create | Modify — responsibility

## Public contracts (keep stable across tasks)
Only the signatures/types later tasks depend on — names, params, return types. NOT
implementations. (Omit this section for trivial features.)
- `module/path` — `functionName(args): ReturnType` — one-line behavior
- `type/interface Name { ... }`

## Tasks
Each task is an independently testable deliverable with a stable ID (T1, T2, ...).
Describe the deliverable, the contract it exposes, and the behaviors the implementer must
cover with tests — not the code itself.

### T1: <component>
**Files:**
- Create: `exact/path`
- Modify: `exact/path:line-range`

**Deliverable:** what works when this task is done.

**Contract (if any):** exact public names/types/signatures this task exposes for later tasks
to consume. Keep these stable; the implementer fills in the bodies.

**Behaviors to cover with tests:** the cases the implementer must write tests for (happy
path, edge cases, error handling) — described as behavior, e.g. "first reveal is never a
mine", not as test code.

**Gate:** the exact command(s) to run and the expected outcome (e.g. `npm test` green,
`npm run build` exits 0).

> Commits are NOT plan steps — committing is handled later by the workflow's commit phase.
> End tasks at a green gate.

## Tests
- AC1 -> T1 / test behavior that covers it
- AC2 -> T2 / test behavior that covers it

## Risks / trade-offs
- ...

## Open questions
- None
