# Documentation Convention Reference

Load this file when the repo's doc convention is unclear, or when you recognize signals that don't match an obvious pattern.

## Common layouts

### 1. Flat `/docs` with topic files

```
docs/
  architecture.md
  configuration.md
  getting-started.md
  integrations.md
  tools.md
```

Signals: kebab-case filenames, README links directly to each file, no subfolders. Best for small-to-medium projects.

**When you see this:** Add a new topic file for new cross-cutting concerns. Extend an existing file for additions to an existing topic.

### 2. `/docs` with subfolders by audience or type

```
docs/
  guides/
    getting-started.md
    deployment.md
  reference/
    configuration.md
    api.md
  integrations/
    optimizely.md
    crystallize.md
  tools/
    kiota.md
    strawberry-shake.md
  architecture/
    overview.md
    decisions/
      0001-choose-tauri.md
```

Signals: multiple subfolders under `docs/`, each with a topical scope. Often combined with ADRs.

**When you see this:** Place new content in the matching subfolder. Ask yourself:
- How-to → `guides/`
- Lookup (env vars, API shapes) → `reference/`
- External system → `integrations/`
- A tool devs invoke → `tools/`
- A design decision → `architecture/` or `architecture/decisions/`

### 3. ADR-driven

```
docs/
  adr/
    0001-use-sqlite.md
    0002-switch-to-tauri.md
    0003-adopt-svelte.md
```

Signals: numbered files with `adr` in the path. Each file follows a template (Context, Decision, Consequences).

**When you see this:** Any *new architectural choice* on the branch becomes a new numbered ADR. Feature/config/tool changes still go in their usual places. ADR template is usually:

```markdown
# ADR-NNNN: <decision title>

## Status
Accepted | Proposed | Superseded by ADR-XXXX

## Context
What problem are we solving? What constraints matter?

## Decision
What did we decide?

## Consequences
What becomes easier/harder as a result?
```

Copy the style of existing ADRs exactly — header format, numbering width (0001 vs 001 vs 1), section names, status vocabulary.

### 4. Per-module READMEs

```
src/
  Auth/
    README.md
  Billing/
    README.md
  CmsIntegration/
    README.md
```

Signals: multiple `README.md` files nested in source folders, each scoped to one module. Common in .NET solutions and monorepos.

**When you see this:** Branch changes to `src/Auth/*` get documented in `src/Auth/README.md`. Cross-module changes go in a top-level `docs/` file or root README.

### 5. Docs-as-site (Docusaurus, VitePress, MkDocs, etc.)

Signals: `docusaurus.config.js`, `mkdocs.yml`, `.vitepress/config.ts`, sidebar/navigation config files, often `docs/` with strict structure enforced by the site generator.

**When you see this:** Look at the sidebar config first — it tells you exactly which files exist and in what order. New docs must be added to both the file tree *and* the sidebar config, otherwise they won't render. Flag this in the plan.

## File naming conventions

| Pattern | Example | Where you see it |
|---|---|---|
| kebab-case | `getting-started.md` | Most modern projects, static site generators |
| PascalCase | `GettingStarted.md` | .NET-heavy repos, Windows-origin projects |
| SCREAMING_SNAKE | `ARCHITECTURE.md`, `CONTRIBUTING.md` | Root-level meta docs by GitHub convention |
| numbered | `0001-title.md` | ADRs |

**Rule:** Match the majority pattern in the target folder. SCREAMING_SNAKE is reserved for root-level meta files; don't use it for regular content docs.

## Heading conventions

Check the first heading of existing docs:

- **Single `#` per file** (most common): file starts with `# Title`, all other headings are `##` or deeper.
- **No `#`, starts at `##`**: the site generator uses the filename or frontmatter as the title.
- **YAML frontmatter**: `---\ntitle: ...\n---` at the top. Common in Docusaurus, Hugo, Jekyll.

Match what the existing docs in the same folder do.

## Cross-linking conventions

Look at how existing docs link to each other:

- **Relative paths**: `[see config](./configuration.md)` or `[see config](../reference/configuration.md)`
- **Root-absolute**: `[see config](/docs/configuration.md)`
- **Bare filenames**: some site generators resolve `[see config](configuration)`

Match the existing style. When in doubt, use relative paths — they work on GitHub and in most site generators.

## Ecosystem-specific norms

### .NET / C#
- Root `README.md` for onboarding
- `docs/` or `doc/` for extended content
- Often per-project READMEs in solution folders
- XML doc comments on public APIs are the *code* docs — markdown is for concepts, architecture, integrations, and workflows
- `.NET tool` conventions: tools installed via `dotnet-tools.json` deserve a `docs/tools/<tool>.md` with usage commands
- ADRs increasingly common

### Node / JavaScript / TypeScript
- `README.md` does heavy lifting — often includes API reference inline for small packages
- `docs/` for bigger projects
- TypeDoc/JSDoc output sometimes lives in `docs/api/` — don't hand-edit generated content
- Monorepos (Turborepo, Nx, pnpm workspaces) usually have per-package READMEs plus a root `docs/`

### Python
- `README.md` + `docs/` with Sphinx (`.rst`) or MkDocs (`.md`)
- If you see `conf.py` or `mkdocs.yml`, respect the site structure
- API docs typically auto-generated from docstrings — don't hand-edit

### Polyglot monorepos
- Root `docs/` for cross-cutting concerns
- Per-app/per-service docs inside each app folder
- Architectural decisions at the root level

## When signals conflict

Pick the pattern used by the **most recently modified** docs. Use `git log -1 --format=%ci <file>` to check. Recent > old when conventions drifted.

If this change itself introduces new docs, that counts as the new convention going forward — but only if the human explicitly set that direction.
