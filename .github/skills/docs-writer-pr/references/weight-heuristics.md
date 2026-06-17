# Weight Heuristics

Load this when you're unsure whether a specific change has enough weight to document.

## The core test

> **Would a developer joining this project in six months be worse off not knowing this?**

If yes → document it.
If no → skip it.

Most diff content fails this test. That's expected.

## The nine categories of weight

Every change worth documenting falls into one of these. If you can't place a change in one, it's probably noise.

### 1. Package / tool choices

**What counts:** The project adopted, replaced, or removed a notable package or tool.

| Weight | Example |
|---|---|
| ✅ High | "Adopted Kiota for generating .NET API clients" |
| ✅ High | "Replaced MediatR with custom dispatcher" |
| ✅ High | "Added Serilog for structured logging" |
| ❌ Noise | "Bumped Serilog 3.1.1 → 3.1.2" |
| ❌ Noise | "Updated 14 transitive dependencies via Dependabot" |

**Rule:** Document the *choice*, not the *version*. Versions change; the choice usually doesn't. Skip specific version numbers unless a version is load-bearing ("requires .NET 9 or later because of X").

### 2. Integrations

**What counts:** How the project talks to an external system.

| Weight | Example |
|---|---|
| ✅ High | "Integrates with Optimizely CMS — content fetched via ContentReference API" |
| ✅ High | "Crystallize GraphQL — schema fetched at build, typed via StrawberryShake" |
| ✅ High | "Azure DevOps pipeline triggers via service hook" |
| ❌ Noise | "Renamed a DTO in the Optimizely client" |

**Rule:** New integrations always get documented. Changed integrations get documented when the *contract* or *behavior* changes, not when internals move around.

### 3. Tools and how to use them

**What counts:** Commands a developer has to run to work on this project.

| Weight | Example |
|---|---|
| ✅ High | ".NET tool: Kiota — regenerate client with `dotnet tool run kiota generate ...`" |
| ✅ High | "EF Core migrations — add with `dotnet ef migrations add <name>`" |
| ✅ High | "Tauri — `pnpm tauri dev` for dev, `pnpm tauri build` for release" |
| ✅ High | "Custom CLI in `tools/` — usage examples" |
| ❌ Noise | "A new one-off script in `scripts/` that nobody else will run" |

**Rule:** If a developer needs to invoke it to work on the project, it belongs in docs — usually under "Getting Started" or a `docs/tools/` folder.

### 4. Architectural decisions

**What counts:** A chosen approach where alternatives were considered, or a pattern newly introduced.

| Weight | Example |
|---|---|
| ✅ High | "Chose Tauri over Electron / .NET MAUI — reasoning documented in ADR" |
| ✅ High | "Adopted repository pattern for data access" |
| ✅ High | "Moved from in-memory store to SQLite for local persistence" |
| ❌ Noise | "Refactored `FooService` to use primary constructor" |
| ❌ Noise | "Extracted helper method" |

**Rule:** If the repo uses ADRs, new architectural decisions become new numbered ADRs. If not, they go in `docs/architecture.md` or similar. Include the alternatives considered when that context matters.

### 5. Workarounds

**What counts:** "This does X unusual thing because of Y external constraint."

| Weight | Example |
|---|---|
| ✅ Very high | "Ghostty config sets X because `macos-titlebar-style=tabs` conflicts with Y on macOS Tahoe" |
| ✅ Very high | "Kiota client is checked in rather than regenerated in CI because the spec endpoint requires VPN" |
| ✅ Very high | "We retry 502s from Crystallize up to 3 times — their edge occasionally returns transient errors on cache miss" |
| ❌ Noise | "Standard null check" |

**Rule:** Workarounds are the **highest-value documentation** because they decay silently — someone "cleans up" the weird code and breaks the system. Always document the reason.

### 6. How to start the project

**What counts:** Prerequisites, setup, run, test. Anything in the onboarding path.

| Weight | Example |
|---|---|
| ✅ High | "Prerequisites: .NET 9 SDK, Node 20+, Docker Desktop, pnpm" |
| ✅ High | "Local services required: Postgres (via `docker-compose up db`), Azurite" |
| ✅ High | "First-time setup: `dotnet tool restore`, then `pnpm install`" |
| ✅ High | "Run: `dotnet run --project src/Api`, web at `http://localhost:5174`" |
| ✅ High | "Secrets: copy `.env.example` to `.env.local`, fill in X and Y (get from 1Password vault 'TeamDev')" |

**Rule:** Anything a new developer needs on day one belongs in README or `docs/getting-started.md`. If the branch changes any of this, the docs must follow.

### 7. Configuration

**What counts:** Environment variables, config files, defaults, override precedence.

| Weight | Example |
|---|---|
| ✅ High | "`TT_DB_PATH` — path to SQLite file. Default: `~/.timetracker/tt.db`" |
| ✅ High | "`appsettings.json` → `Logging:LogLevel:Default` — controls log verbosity" |
| ✅ High | "Config precedence: env vars > `appsettings.{env}.json` > `appsettings.json`" |
| ✅ High | "Changed default for `Retry:MaxAttempts` from 3 to 5" (behavior change) |
| ❌ Noise | "Renamed internal config class" |

**Rule:** Every env var and every config key a developer might touch gets documented. Include defaults and whether it's required for local dev.

### 8. Edge-case handling

**What counts:** Behavior that isn't obvious from reading the code — retries, fallbacks, idempotency, ordering, timeouts, rate limits, partial failure.

| Weight | Example |
|---|---|
| ✅ High | "Webhook handler is idempotent — replays with same `event_id` are no-ops" |
| ✅ High | "On Crystallize 429, backs off exponentially up to 60s, then fails the request" |
| ✅ High | "Time entries across DST boundaries are stored in UTC; UI converts on display" |
| ❌ Noise | "Added a null check" |

**Rule:** If a developer would be surprised by the behavior when reading the code, document it near the entry point.

### 9. Breaking changes

**What counts:** Anything that breaks consumers — public APIs, config keys, CLI flags, schemas, minimum runtime versions.

| Weight | Example |
|---|---|
| ✅ Always | "Removed `/api/v1/legacy-entries` — migrate to `/api/v2/entries`" |
| ✅ Always | "Renamed env var `DB_URL` → `DATABASE_URL`" |
| ✅ Always | "Minimum runtime bumped to .NET 9 (was .NET 8)" |
| ✅ Always | "Default for `Retry:Enabled` changed from `false` to `true`" |

**Rule:** Breaking changes are the loudest thing in documentation. Give them a dedicated section or their own heading. If the change requires migration, include the migration steps.

## What to ignore (the noise list)

These almost never have weight on their own:

- Patch/minor package version bumps
- Lockfile churn with no manifest change
- Whitespace, formatting, comment edits
- Renames of private/internal symbols
- Generated files (`*.Designer.cs`, `*.g.cs`, generated OpenAPI clients, migration bodies)
- Test additions (unless they introduce a *new testing pattern* the team should adopt)
- IDE config (`.vscode/`, `.idea/`) unless it's an intentional team-wide settings file
- Bug fixes that restore documented behavior
- Refactors that don't change external surface

If the entire branch consists of these, say so and ask the user whether to proceed.

## Inferring weight from commits

Run `git log --oneline origin/main..HEAD` and scan for signals:

| Prefix | Typical weight |
|---|---|
| `feat:` | Often weight — check what it enables |
| `feat!:` or `BREAKING:` | Always weight |
| `fix:` | Rarely weight — unless it changes documented behavior |
| `refactor:` | Rarely weight — unless it changes how devs work |
| `perf:` | Weight if measurable/user-visible |
| `chore:`, `style:`, `ci:`, `build:` | Usually not weight |
| `docs:` | Already documented — check what this branch did to docs |
| `deps:` | Weight only for major upgrades or new/removed deps |

Scan for keywords in commit messages too: "add", "integrate", "migrate", "switch", "replace", "workaround", "fix prod issue", "env var", "config", "breaking" → likely weight. "cleanup", "tidy", "rename", "reformat", "lint" → likely noise.

## When the diff is huge

Don't read every line. Prioritize:

1. New files, especially those touching public surface (controllers, handlers, exports, schemas, config)
2. Manifest/config file changes (`*.csproj`, `package.json`, `Directory.Packages.props`, `appsettings.*.json`)
3. New top-level folders
4. Commit messages as a narrative

Skip:
- Giant generated files
- Pure formatting diffs (use `git diff -w` to check)
- Test files unless testing patterns change

## When the diff is trivial

If the whole branch is version bumps and formatting, there's probably nothing to document. Say that clearly — don't invent weight that isn't there. Pretending trivial changes are significant devalues the rest of the docs.

**Zero output is a correct outcome.** When a branch genuinely has no weight, the right answer is "nothing needs documenting." That's a feature, not a failure. Branches that commonly produce no docs:

- Dependency bump branches (Dependabot, Renovate, manual patch updates)
- Pure bug-fix branches that restore documented behavior
- Refactor branches with no external surface change
- Formatting / lint / style branches
- Test-only branches (unless introducing a new testing pattern)
- Comment / typo branches

Report honestly and stop. Don't stretch to fill a page.
