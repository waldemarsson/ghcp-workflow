# Copilot workflow

Source for a **gated, feature-driven development workflow** that runs globally in the
GitHub Copilot CLI from `~/.copilot`. You edit the workflow here, then deploy it by
copying the pieces into `~/.copilot/` so they work in **any** project on your machine.

## What's in it

The workflow drives **one feature per session** through a series of gates, where a human
approves each step before the next begins.

For token efficiency the orchestrator keeps chat terse (detail lives in the artifacts) and
offers a **context reset** at each gate that precedes an autonomous phase — all state is
durable on disk, so clearing the conversation and resuming loses nothing.

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
  - `templates/spec.md`, `templates/plan.md` — canonical artifact structures (Standard track).
  - `templates/spec-plan.md` — merged spec+plan artifact for the Quick track (single gate).
  - `references/conventions.md`, `references/weight-heuristics.md` — guidance the
    documenter consults.
  - `references/review-checklist.md`, `references/verification.md` — checklists the reviewer
    and implementer load just-in-time (kept out of their prompts to save tokens).

Per-feature state lives under `~/.copilot/workflow/features/<project-slug>/<date>-<slug>/`
(created by `store.mjs`), never in this repo.

## Model configuration

Each agent picks its own model via the `model:` field in its frontmatter
(`agents/<name>.agent.md`). To change which model an agent uses, edit that field and
redeploy. The defaults are role-matched:

| Agent          | Default model       | Why                                          |
| -------------- | ------------------- | -------------------------------------------- |
| `orchestrator` | `claude-opus-4.8`   | Drives the interactive phases and dispatch.  |
| `implementer`  | `gpt-5.3-codex`     | Writes the code and tests.                   |
| `reviewer`     | `claude-sonnet-4.6` | Reviews the diff.                            |
| `documenter`   | `claude-sonnet-4.6` | Updates the docs.                            |

There is no central config file: the `model:` frontmatter field **is** the configuration
point, one per agent. This keeps all four agents consistent — including the
`orchestrator`, which is invoked directly (`/agent orchestrator`) and so cannot receive a
model override from anything that dispatches it. Model IDs go stale as new models ship, so
check these against the models your Copilot CLI currently offers.

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

Run the deploy script — it copies the three managed directories into `~/.copilot/`
(additive/overwrite; it never deletes anything at the destination, so live per-feature
state under `~/.copilot/workflow/features/` is safe):

```sh
./deploy.sh            # deploy
./deploy.sh --dry-run  # preview changes without writing
```

Or copy them by hand (per directory, so contents land in the matching target):

```sh
for d in agents extensions workflow; do
  rsync -a --exclude='.DS_Store' "$d/" ~/.copilot/"$d"/
done
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
