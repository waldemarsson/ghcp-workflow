# Review checklist (reviewer)

Loaded by the reviewer at Step 1 (just-in-time, so the full checklist isn't resident in the
prompt every dispatch). Assess **every dimension** below against the code you actually read;
categorize findings by real severity and give each a stable id (H1/M2/L3…).

- **Plan alignment** — does it match spec & plan? Is all planned functionality present? Are
  deviations justified improvements or problematic departures? Flag deviations specifically.
  If the *plan itself* is wrong, say so.
- **Code quality** — separation of concerns, error handling, type safety, DRY without
  premature abstraction, edge cases.
- **Architecture** — sound design, scalability/performance, integrates cleanly.
- **Security** — input validation, secrets, injection, authz.
- **Testing** — tests verify real behavior (not just mocks), edge cases covered, all tests
  passing.
- **Style & formatting** — naming, readability, lint/format consistency.
- **Production readiness** — backward compatibility, migrations, docs, no obvious bugs.

**Calibration:** not everything is HIGH. Categorize by *actual* severity. Acknowledge what was
done well before listing issues — accurate praise helps the implementer trust the rest.
