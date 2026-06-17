# docs-writer-pr

A portable Agent Skill that documents the **changes of weight** on your current git branch before you open a PR, following your repo's existing documentation conventions.

Works in **Claude Code** and **GitHub Copilot CLI** — same file, either location.

## What it does

1. Analyzes commits on your branch vs. `main`
2. Filters out noise (version bumps, formatting, internal refactors) and keeps only things of weight: package/tool choices, integrations, architecture, setup, configuration, edge-cases, workarounds, breaking changes
3. Scans your README and follows every doc link to learn your repo's convention
4. Proposes a written plan: which files to update, which to create, what to put where, and what it's explicitly ignoring
5. Prints the full plan in the terminal and waits for your approval
6. Writes the docs
7. Leaves committing to you

**Does not** touch `CHANGELOG.md` or release notes. **Does not** commit or push.

## The weight principle

Most of what's in a diff isn't worth documenting. This skill's rule:

> Would a developer joining this project in six months be worse off not knowing this?

If yes → document. If no → skip. Version bumps, refactors, and renames almost always fail this test and get ignored by design.

## Install

### As a personal skill (available in every repo)

**Claude Code:**
```bash
cp -r docs-writer-pr ~/.claude/skills/
```

**GitHub Copilot CLI:**
```bash
cp -r docs-writer-pr ~/.copilot/skills/
```

**Both at once (using the shared `~/.agents/skills/` location supported by both):**
```bash
mkdir -p ~/.agents/skills
cp -r docs-writer-pr ~/.agents/skills/
```

### As a project skill (committed to one repo)

```bash
# For Claude Code
cp -r docs-writer-pr .claude/skills/

# For Copilot CLI
cp -r docs-writer-pr .github/skills/
```

You can commit `.claude/skills/` or `.github/skills/` so your team shares the skill.

## Use

In Claude Code or Copilot CLI, from any git repo on a feature branch:

> document my branch

> document the changes on this branch before I open a PR

> write docs for what I changed vs main

The skill activates, walks the phases, prints the full plan at the approval gate, and waits. Reply "yes" or tell it what to adjust.

## Files

```
docs-writer-pr/
├── SKILL.md                         # Entry point + workflow
├── references/
│   ├── weight-heuristics.md         # Category-by-category "is this worth documenting?"
│   └── conventions.md               # How to recognize common doc conventions
└── README.md                        # This file
```

## Assumptions to double-check on first run

- Your branch is compared against `origin/main`. Falls back to `master`/`develop` if that doesn't exist.
- New files (when no existing doc fits) go in `/docs/` at the repo root. The plan will say so — override in reply if you want them elsewhere.
- The skill never commits or pushes. That's yours to do after review.
