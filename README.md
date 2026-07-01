# Copilot workflow

Source for a **gated, feature-driven development workflow** that runs globally in the
GitHub Copilot CLI from `~/.copilot`. You edit the workflow here, then deploy it by
copying the pieces into `~/.copilot/` so they work in **any** project on your machine.

## What's in it

The workflow drives **one feature per session** through a series of gates, where a human
approves each step before the next begins.

- **`agents/` — the four workflow agents**
  - `orchestrator` — the only agent the human talks to. Runs the interactive phases
    (discovery, spec, planning, fix-selection, commit) and dispatches the others.
  - `implementer` — writes the code and tests per the approved plan, reports verified
    results.
  - `reviewer` — read-only senior review of the diff; returns a calibrated
    HIGH/MEDIUM/LOW report.
  - `documenter` — updates the repo's own docs to reflect what shipped.
- **`extensions/workflow-gate/` — the guardrail extension**
  - `extension.mjs` hard-blocks dispatching an autonomous subagent whose gate is not yet
    approved.
  - `store.mjs` is the state CLI (`create | root | path | get | set | list`) that
    records each feature's phase and approvals in `state.json`.
  - `store.test.mjs` covers the store/CLI behavior.
- **`workflow/` — shared assets the agents read at runtime**
  - `templates/spec.md`, `templates/plan.md` — canonical artifact structures.
  - `references/conventions.md`, `references/weight-heuristics.md` — guidance the
    documenter consults.

Per-feature state lives under `~/.copilot/workflow/features/<project-slug>/<date>-<slug>/`
(created by `store.mjs`), never in this repo.

## Repository layout ↔ `~/.copilot`

The repo root **mirrors `~/.copilot/` one-to-one**, so deployment is a plain copy:

| Repo (edit here) | Runtime (`~/.copilot/`)  |
| ---------------- | ------------------------ |
| `agents/`        | `~/.copilot/agents/`     |
| `extensions/`    | `~/.copilot/extensions/` |
| `workflow/`      | `~/.copilot/workflow/`   |

These directories live at the repo **root** (not under `.github/`) so that Copilot does
**not** auto-load the agents and extension while you develop them here — otherwise they'd
be loaded from both this repo and `~/.copilot`.

`.github/copilot-instructions.md` is **repo-local guidance only** — it is not deployed.

## Deploy

Copy the three directories into `~/.copilot/`:

```sh
cp -R agents extensions workflow ~/.copilot/
```

## Path convention (important)

Any path an agent **executes or loads at runtime** — the `store.mjs` CLI, the templates,
the references — must be written as an absolute `~/.copilot/...` path, **never**
`.github/...` or a repo-relative path. Agents run from an arbitrary project's working
directory after deployment, so only `~/.copilot/...` resolves there.

When editing files under `agents/` or `workflow/`, keep every runtime path anchored at
`~/.copilot/`.

## Running the tests

The `workflow-gate` store has a test suite (Node's built-in test runner, no dependencies):

```sh
node --test extensions/workflow-gate/store.test.mjs
```

The tests resolve `store.mjs` relative to the test file, so they pass regardless of the
working directory.
