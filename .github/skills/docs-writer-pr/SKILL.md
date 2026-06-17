---
name: docs-writer-pr
description: Documents changes of weight on the current git branch before opening a PR — package/tool choices, integrations, architectural decisions, setup and prerequisites, configuration, and workarounds — by discovering the repo's documentation conventions, proposing a placement plan, and writing the docs after user approval. Use whenever the user asks to "document my branch", "document the diff", "document what I changed", "update docs before opening a PR", "write docs for this branch", or any request to reflect significant branch-level changes into the repo's markdown documentation. Deliberately ignores small churn, version bumps, and internal refactors that don't change how others work. Does not touch CHANGELOG or release notes.
---

# Docs Writer (PR)

Document the things on this branch that *matter* — the decisions, the integrations, the setup — in the style the repo already uses. Ignore the noise.

## Guiding principle: weight, not volume

Most diffs contain a lot of change and little of it is worth documenting. This skill's job is to identify the few things **future developers will need to know** and write those down clearly. Everything else is noise.

**Document things of weight:**

- **Package / tool choices** — which packages or tools the project uses and why (not which version). "We use Kiota for generating API clients" is weight. "Bumped Kiota from 1.16.0 to 1.17.0" is not.
- **Integrations** — how the project talks to external systems (Optimizely CMS, Crystallize, Azure DevOps, auth providers, databases). New integrations always get documented; changed integrations usually do.
- **Tools and how to use them** — .NET tools like Kiota, StrawberryShake, EF Core migrations, custom CLIs. If a developer has to run a command to work on this project, it belongs in docs.
- **Architectural decisions** — new layers, new patterns, chosen approaches, rejected alternatives when they inform the reader.
- **Workarounds** — "this does X because of Y quirk in Z." Workarounds are the highest-value documentation because they decay silently without it.
- **How to start the project** — prerequisites (runtime versions, local services, secrets), setup steps, how to run, how to test.
- **Configuration** — environment variables, config files, defaults, precedence, required-for-local-dev vs. required-for-prod.
- **Edge-case handling** — behavior that isn't obvious from reading the code: retries, fallbacks, idempotency, ordering guarantees.
- **Breaking changes** — always. Louder than anything else.

**Do not document:**

- Specific version numbers of packages (unless a version constraint is load-bearing — e.g., "requires .NET 9.0.100 or later due to X")
- Minor/patch version bumps
- Lockfile churn
- Internal refactors that don't change how others build/test/extend the code
- Renames, reformatting, comment changes
- Test additions (unless they introduce a new testing pattern the team should adopt)
- Generated code (`*.Designer.cs`, migration bodies, OpenAPI-generated clients)
- Individual bug fixes unless they change documented behavior

**The test:** "Would a developer joining this project in six months be worse off not knowing this?" If yes, document it. If no, skip it.

**Zero documentation is a valid outcome.** Many branches don't have anything of weight — bug fixes, dependency bumps, refactors, formatting passes, test improvements. When that's the case, say so plainly and stop. Do not invent weight that isn't there. An honest "nothing here needs documenting" is more valuable than pages of noise, and it preserves the signal in the docs that already exist.

See `references/weight-heuristics.md` for the detailed category-by-category test.

## What this skill does (and doesn't)

**Does:** Analyze commits on the current branch vs. `main`, discover the repo's existing documentation structure, propose a placement plan for changes of weight, get user approval, then write or update markdown docs.

**Does not:** Touch `CHANGELOG.md`, release notes, commit messages, or PR descriptions. Does not write without approval. Does not invent facts not supported by the diff or commit history. Does not document trivial churn.

## Workflow

Follow these phases in order. **Do not skip the approval gate.**

### Phase 1 — Analyze the branch

Run these in order. If any fails, stop and report to the user.

```bash
# 1. Confirm we're in a git repo and not on main
git rev-parse --is-inside-work-tree
git branch --show-current

# 2. Identify the base branch (usually main, sometimes master/develop)
git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main"

# 3. Find the merge base and list commits on this branch only
git merge-base HEAD origin/main
git log --oneline origin/main..HEAD

# 4. Get the file-level diff summary and the full diff
git diff --stat origin/main...HEAD
git diff origin/main...HEAD
```

Notes:
- Use `origin/main...HEAD` (three dots) so you see changes introduced on the branch, not changes on main since it diverged.
- If `origin/main` doesn't exist, fall back to `main`, then `master`, then `develop`.
- If the current branch IS main/master, stop and tell the user.

From the diff and commit log, build a list of **things of weight** using the guiding principle above. For each candidate, ask: "is this a decision, an integration, a tool, a workaround, setup, config, an edge case, or a breaking change?" If it doesn't fit any of those, it's probably noise.

If you find nothing of weight, that is a fine outcome — **report it and stop**. Do not proceed to Phase 2. Say something like:

> I looked at the <N> commits on this branch. I didn't find anything of weight that needs documenting — it's mostly <e.g. "patch-version dependency bumps and a refactor of the internal ClockService that doesn't change external behavior">. If you think I missed something, point me at it and I'll take another look.

Pure bug-fix branches, dependency-bump branches, refactor branches, and formatting/lint branches often have no docs output, and that's correct. Don't invent weight.

### Phase 2 — Discover documentation conventions

This is the "scan and follow" step. Work through it in order.

**2a. Read the README.**

```bash
ls README* readme* 2>/dev/null
```

Read the root README fully. Extract every relative markdown link (`.md` files). These are the entry points to the repo's documentation graph.

**2b. Follow the links.**

For each markdown file the README links to, read it. Then read any markdown files **those** link to, up to one more level deep. You're looking for:
- A `docs/` folder and how it's organized (by topic? by audience? by feature?)
- An `ARCHITECTURE.md`, `CONTRIBUTING.md`, `GETTING_STARTED.md`, or similar top-level doc
- Per-module READMEs (e.g. `src/SomeModule/README.md`)
- A documentation index or table of contents
- ADRs (`docs/adr/NNNN-*.md`)

```bash
# Useful for finding all markdown in the repo
find . -name "*.md" -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./bin/*" -not -path "./obj/*" | head -50
```

**2c. Detect the convention.**

Look for these signals and note what you find. See `references/conventions.md` for a full catalog of common patterns across .NET, Node, and polyglot repos.

Signals to look for:
- Folder structure: `docs/`, `docs/adr/`, `docs/guides/`, `docs/integrations/`, `docs/architecture/`
- File naming: `kebab-case.md`, `PascalCase.md`, `SCREAMING_SNAKE.md`
- Heading depth: does every file start with a single `#`, or does it start at `##`?
- ADR presence: numbered files like `0001-use-tauri.md` — new architectural decisions should go there
- Front matter: some repos use YAML frontmatter on doc pages
- Cross-linking style: relative paths, absolute paths from repo root, or just filenames
- Language: is existing documentation in English, Swedish, or mixed? Match what's there.

**2d. Classify the convention state.**

Pick one:

- **Clear convention exists** — Follow it exactly. Note the convention in your plan so the user can confirm you read it right.
- **Partial / inconsistent convention** — Some docs follow one pattern, others don't. Pick the pattern used by the **most recent** docs (check `git log` on doc files). Flag this to the user and offer (once, at end of Phase 5) to record the convention in a `docs/CONVENTIONS.md`.
- **No convention** — Only a README exists, or docs are ad-hoc. Propose a minimal convention: put new docs in `/docs/<kebab-case-topic>.md`, one `#` top heading matching the filename, link from the README under a "Documentation" section. Do not write a convention file unless the user asks.

### Phase 3 — Propose a plan (APPROVAL GATE)

Do not write any files yet. Present a plan to the user with exactly this shape.

**Approval-gate rule:** when asking for approval, always print the full plan to the terminal in the same message. Do not ask for approval with only a summary, a reference to the plan, or a partial excerpt. If you revise the plan after user feedback, print the full revised plan again before asking for approval again.

Use exactly this shape:

```
## Documentation plan

**Branch:** <branch-name> (<N> commits vs main)

**Convention detected:** <one-line summary, e.g. "docs/ with kebab-case topics, linked from README under ## Documentation; ADRs in docs/adr/">

**Things of weight I found:**

1. **New integration: Kiota-generated client for Intrims API**
   → Update `docs/integrations.md` — add "Intrims API" section
   - How to regenerate the client (`dotnet tool run kiota`)
   - Where the spec lives and how to refresh it
   - Auth setup for local dev

2. **New tool: StrawberryShake for Crystallize GraphQL**
   → Create `docs/tools/strawberry-shake.md` (no existing tools doc)
   - Prerequisites: .NET tool install command
   - How to regenerate types from schema
   - Common gotcha: schema fetch requires tenant env var

3. **Architectural decision: SQLite for local time storage (was in-memory)**
   → Create `docs/adr/0004-sqlite-local-storage.md` (follows existing ADR format)
   - Context, decision, consequences per existing ADR template

4. **New prerequisite: .NET 9 SDK**
   → Update `README.md` "Getting Started" → Prerequisites list

5. **Workaround: Ghostty + code-signing on macOS Tahoe**
   → Update `docs/getting-started.md` — add "Known issues" section

**Ignored as noise:**
- ~15 package version bumps (patch/minor)
- Internal refactor of `ClockService` (no external surface)
- Test additions, formatting

**Ready to proceed?** Reply "yes" to have me write these changes, or tell me what to adjust.
```

Rules for the plan:
- Lead each item with **what** the change is and **why it has weight**, then state the doc action
- Say **Update** or **Create** explicitly
- For new files, state why no existing file fits
- New files go in `/docs/` at the project root unless the detected convention says otherwise
- Always include the "Ignored as noise" list so the user can overrule if something on it actually matters
- If you're proposing a brand-new convention (no convention existed), call that out as its own item

**Wait for explicit approval.** "yes", "lgtm", "go", "looks good" all count. If the user asks for changes, revise the plan and re-present. Do not write until approved. Every approval request must include the full current plan printed in the terminal message that asks for approval.

### Phase 4 — Write the docs

After approval:

1. Write each file change one at a time.
2. For **updates**, use targeted edits — insert new sections in the right place (usually before a reference section or at the end of the relevant parent section). Do not rewrite whole files.
3. For **new files**, match the detected convention: heading style, link style, any frontmatter.
4. For **ADRs**, copy the exact structure of existing ADRs (section names, numbering width, status vocabulary).
5. If the README needs a new link to a new doc, add it in the same section the README already uses for documentation links. If none exists, add a `## Documentation` section near the end of the README, before any "License" or "Contributing" section.
6. Keep prose tight. Prefer short sections with concrete examples — actual commands, actual file paths, actual env var names from the diff — over abstract descriptions.
7. Use code blocks with language tags for any code/config.
8. **Never write specific package versions** in prose unless the version is load-bearing. Write "uses Kiota" not "uses Kiota 1.17.0".
9. Do not invent rationale. If the diff doesn't show *why* a change was made and commits don't explain it, describe *what* changed and mark rationale as "TBD — author to fill in" rather than guessing.

### Phase 5 — Report

After writing, summarize:

```
## Done

Files written:
- `docs/integrations.md` (updated, +38 lines, "Intrims API" section)
- `docs/tools/strawberry-shake.md` (created, 42 lines)
- `docs/adr/0004-sqlite-local-storage.md` (created, 28 lines)
- `docs/getting-started.md` (updated, +12 lines, "Known issues")
- `README.md` (updated, +3 lines, prerequisites + doc links)

Review before committing:
- 2 "TBD — author to fill in" markers in docs/adr/0004-sqlite-local-storage.md

Run `git diff` to review, then commit when ready.
```

Then stop. Do not commit, do not push, do not open a PR.

## Handling the "inconsistent convention" case

If you detected partial/inconsistent conventions in Phase 2d and the user approved the plan, offer (once, at the end of Phase 5) to write a short `docs/CONVENTIONS.md` capturing the convention you followed, so future runs — yours or a human's — stay consistent. Example prompt:

> The existing docs were inconsistent. I followed the pattern from the most recent docs (kebab-case, single `#` heading per file, relative links). Want me to write a short `docs/CONVENTIONS.md` recording this so future docs stay aligned? (yes/no)

Only write it if the user says yes. Do not bring this up if the convention was already clear.

## Constraints

- **Weight over volume.** When in doubt, leave it out. A short, dense doc plan is better than a long one full of noise.
- **Zero output is a valid outcome.** If nothing on the branch has weight, say so and stop. Don't manufacture documentation to justify being invoked.
- **Never write without approval.** The plan in Phase 3 is a hard gate.
- **Never touch CHANGELOG.md or release notes.** Out of scope.
- **Never commit or push.** The user reviews and commits themselves.
- **Match the repo's language.** If existing docs are in Swedish, write in Swedish. If mixed, default to English but ask.
- **Respect existing file boundaries.** Don't merge two existing docs. Don't split an existing doc. Only add sections or create new sibling files.
- **No version numbers in prose** unless load-bearing.
- **No AI attribution footers** on documentation files.

## References

- `references/weight-heuristics.md` — Category-by-category test for "is this worth documenting?" Load when you're on the fence about whether a change qualifies.
- `references/conventions.md` — Catalog of common doc conventions (ADRs, docs/ layouts, .NET/Node/Python norms) and how to recognize each. Load when the repo's convention isn't obvious.

Read these only if the main flow isn't enough.
