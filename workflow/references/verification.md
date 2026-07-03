# Verification protocol (implementer)

Loaded by the implementer at Step 2 (just-in-time, so it isn't resident in the prompt every
turn). **Iron Law: no completion claims without fresh verification evidence** — if you didn't
run the command *this turn*, you cannot say it passes.

## Run every gate fresh, in this order

1. **Tests** — run the FULL suite fresh; read the output, count failures. Claim "pass" only
   with the actual numbers (e.g. `34/34 passed`). Never "should pass" / "looks correct".
2. **Build / lint** — run it; confirm exit 0. Lint passing ≠ build passing — run both if both
   exist.
3. **Each acceptance criterion** — re-read `spec.md` (or `spec-plan.md` on Quick), verify each
   criterion line-by-line against real behavior (tests passing ≠ all requirements met). Report
   any gaps.
4. **Bug fixes / regression tests** — verify red-green: the test must FAIL without the fix and
   PASS with it, not just pass once.

Red flags that mean you are NOT done: using "should"/"probably"/"seems to", expressing
satisfaction before running verification, or implying success without fresh output. If a
verification fails, fix it or stop and report the real status — never paper over it.

## Canonical return format

Keep the whole return to **≤ ~400 words**. Evidence is **counts + the exact command**, never
pasted logs or diffs (the orchestrator and human read those from the terminal / `git diff`).

```
**Changed:** src/foo.ts (new parser), src/foo.test.ts (12 tests)
**Tests:** `npm test` → 46/46 passed
**Build/lint:** `npm run build` → exit 0 · `npm run lint` → exit 0
**Acceptance criteria:**
- AC1 rejects empty input → met (test: "throws on empty")
- AC2 preserves order → met
**Gaps / follow-ups:** none
```
