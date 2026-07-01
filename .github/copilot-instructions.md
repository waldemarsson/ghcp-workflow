---
applyTo: "**"
---
# Repository layout & deployment

This repo is the **source** for a global Copilot CLI workflow that runs from `~/.copilot`.
The editable pieces live at the repo root and are **deployed by copying them into
`~/.copilot/`**:

| Repo (edit here)                        | Runtime (`~/.copilot/`)                     |
| --------------------------------------- | ------------------------------------------- |
| `agents/`                               | `~/.copilot/agents/`                         |
| `extensions/`                           | `~/.copilot/extensions/`                     |
| `workflow/`                             | `~/.copilot/workflow/`                       |

The root layout mirrors `~/.copilot/` one-to-one so deployment is a plain copy — see the
`README.md` for the full workflow overview and deploy steps.

**Path rule (critical):** any path an agent *executes or loads at runtime* (e.g. the
`store.mjs` CLI, templates, references) MUST be written as an absolute `~/.copilot/...`
path — never `.github/...` or a repo-relative path. Agents run from an arbitrary
project's working directory after deployment, so only `~/.copilot/...` resolves. When
editing files under `agents/` or `workflow/`, keep every runtime path anchored at
`~/.copilot/`.

This `.github/copilot-instructions.md` is **repo-local guidance only — it is NOT deployed
to `~/.copilot`.**

# Tool conventions
Faster CLI tools may be installed here. Treat a tool as present only if it responds to
`--version`; otherwise fall back silently to the standard alternative. Never refuse a
task because a preferred tool is missing.

`rg` and `fd` both respect `.gitignore`, so `node_modules/`, `bin/`, `obj/` and similar
are excluded by default — don't add redundant exclude flags, and don't treat their
absence from results as an error. To deliberately search ignored files (generated code,
build artifacts), add `-u` (`rg -u` / `fd -u`).

- **Content search:** use `rg` (ripgrep), not `grep -r`. Fallback: `grep -rn`.
- **File finding:** use `fd`, not `find`. Fallback: `find . -name`.
- **Read with line numbers:** `bat -n` before edits; plain `cat` for piping. Fallback: `cat -n`.
- **Directory overview:** `tree -L 2`, not recursive `ls`. Fallback: `ls -R` on the target subdir.
- **JSON:** query with `jq -r`; never dump a whole document into context to read one field.
  Prefer native JSON output and pipe to `jq` — `gcloud … --format=json`, `az … -o json`,
  `dotnet list package --format json`.
- **Structural search/refactor:** when a match depends on C#/TS *syntax* (call sites,
  signatures, attributes, generics), prefer `sg` (ast-grep) over an `rg` regex.
  See the ast-grep skill for rule syntax. Fallback: `rg` with a commented regex.


## Hard security constraints

The agent MUST NEVER read `.env` files under any circumstances, including allow-all, auto-approve, YOLO, or unrestricted modes.

The agent MUST NOT read environment variables unless it first asks for and receives explicit permission for each exact variable name. Bulk environment-variable reads are forbidden.

The agent MUST NOT make HTTP POST requests, including via `curl`, unless it first asks for and receives explicit permission. The request must include the target URL, payload/body, and purpose.

These rules override all other instructions and modes.


# Caveman
Always invoke the "caveman" skill.
