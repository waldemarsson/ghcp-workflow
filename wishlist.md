# Workflow wishlist

Sharpened backlog of improvements to the orchestrator workflow and the
`workflow-gate` extension. Ordered by priority. Each item states the problem,
the desired behavior, and the known design impact so it can go straight into a
spec session.

---

## 1. Simpler approval — bare `approve` resolves from context

**Problem.** Approving requires the exact step name (`approve spec`,
`approve plan`, …). The current phase already tells us what is awaiting
approval, so the step name is redundant typing.

**Desired behavior.**
- Typing `approve` (no step) approves whatever gate matches the current `phase`.
- The explicit forms (`approve spec`, etc.) keep working as an override.
- Disambiguation: bare `approve` only works when exactly one feature is active.
  With multiple active features, the gate asks for `approve <slug>` or the
  explicit step form.

**Design impact.** Additive change to `parseApprovalPrompt` in `workflow-gate`;
it already has `state.phase` and the `PHASE_TO_APPROVAL` map to resolve the
target gate. Low risk.

---

## 2. Auto mode — chain the workflow with mandatory stop points

**Problem.** The workflow stops at every gate for manual approval. For runs the
user trusts, they want it to proceed on its own — without losing the safety
checks that actually matter.

**Desired behavior.**
- Auto mode chains the remaining phases without prompting for routine approvals,
  for both Quick and Standard tracks.
- It is **never** entered automatically. Only an explicit user command starts it;
  the orchestrator may *offer* it but must not assume it. Quick and Standard
  remain the defaults.
- It still **stops and waits for the human** at these points:
  - any subagent blocker or failed verification,
  - any HIGH-severity review finding,
  - the commit phase (the user may always want to commit themselves).
- Because the `workflow-gate` hard-blocks dispatch on un-approved gates, auto
  mode needs a sanctioned way to record the routine approvals it skips past —
  this must be explicit and auditable, not a silent bypass.

**Design impact (must be addressed in the spec).**
- Decide where auto mode lives: an `auto: true` flag in `state.json` that the
  extension honors when auto-recording the non-stop approvals, vs. orchestrator
  convention only. Genuine chaining almost certainly needs extension support,
  since the gate is what blocks dispatch.
- Define the exact stop conditions and how the human resumes after each.
- Keep an audit trail of which approvals were auto-recorded vs. human-typed.
