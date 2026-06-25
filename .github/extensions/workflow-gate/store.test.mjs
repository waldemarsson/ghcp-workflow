import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
    collectActiveStates,
    createFeature,
    extractSlugFromText,
    featureDir,
    findState,
    handleApproval,
    handleDispatchGate,
    handleReopen,
    parseState,
    projectRoot,
    projectSlug,
    readState,
    setStateField,
    serializeState,
    validateState,
    writeState,
} from "./store.mjs";

test("projectSlug is stable for same pwd", () => {
    const pwd = "/repo/my-project";
    assert.equal(projectSlug(pwd), projectSlug(pwd));
});

test("projectSlug differs for different pwd values", () => {
    assert.notEqual(projectSlug("/repo/a"), projectSlug("/repo/b"));
});

test("projectSlug starts with basename and ends in 8-char hex hash", () => {
    const slug = projectSlug("/repo/my-project");
    assert.match(slug, /^my-project-[a-f0-9]{8}$/);
});

test("projectRoot nests under home/.copilot/workflow/features", () => {
    const root = projectRoot("/repo/my-project", "/home/alice");
    assert.equal(root, path.join("/home/alice", ".copilot", "workflow", "features", projectSlug("/repo/my-project")));
});

test("featureDir composes date-slug in project root", () => {
    const dir = featureDir("/repo/my-project", "dark-mode", "2026-06-24", "/home/alice");
    assert.equal(
        dir,
        path.join("/home/alice", ".copilot", "workflow", "features", projectSlug("/repo/my-project"), "2026-06-24-dark-mode"),
    );
});

test("extractSlugFromText returns slug from workflow path", () => {
    const text = "See ~/.copilot/workflow/features/proj-12345678/2026-06-24-dark-mode/spec.md";
    assert.equal(extractSlugFromText(text), "dark-mode");
});

test("extractSlugFromText returns null for non-matching text", () => {
    assert.equal(extractSlugFromText("approve plan"), null);
});

function validState(overrides = {}) {
    return {
        slug: "dark-mode",
        track: "standard",
        phase: "spec",
        approved_spec: "",
        approved_plan: "",
        approved_implementation: "",
        approved_review: "",
        approved_docs: "",
        ...overrides,
    };
}

test("valid state round trips serialize -> parse", () => {
    const state = validState({ approved_spec: "2026-06-24" });
    const serialized = serializeState(state);
    assert.deepEqual(parseState(serialized), state);
});

test("parseState fails loudly on invalid JSON", () => {
    assert.throws(
        () => parseState('{"phase":"spec"# comment}'),
        /Failed to parse state JSON:/,
    );
});

test("validateState rejects unknown keys with field name", () => {
    assert.throws(
        () => validateState({ ...validState(), typo_phase: "spec" }),
        /"typo_phase"/,
    );
});

test("validateState rejects invalid phase with field name", () => {
    assert.throws(
        () => validateState(validState({ phase: "bad-phase" })),
        /"phase"/,
    );
});

test("validateState rejects invalid track with field name", () => {
    assert.throws(
        () => validateState(validState({ track: "fast" })),
        /"track"/,
    );
});

test("validateState rejects non-date approval value with field name", () => {
    assert.throws(
        () => validateState(validState({ approved_plan: "yesterday" })),
        /"approved_plan"/,
    );
});

test("validateState accepts empty and ISO-date approvals", () => {
    assert.doesNotThrow(() =>
        validateState(
            validState({
                approved_spec: "",
                approved_plan: "2026-06-24",
                approved_implementation: "",
                approved_review: "2026-06-25",
                approved_docs: "",
            }),
        ),
    );
});

test("readState and writeState persist valid state", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wg-store-test-"));
    try {
        const statePath = path.join(dir, "state.json");
        const state = validState({ phase: "planned" });
        writeState(statePath, state);
        assert.deepEqual(readState(statePath), state);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test("createFeature creates dirs and writes initial valid state.json", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "wg-store-home-"));
    try {
        const dir = createFeature("/repo/app", "dark-mode", { date: "2026-06-24", track: "quick" }, home);
        const statePath = path.join(dir, "state.json");
        assert.equal(fs.existsSync(statePath), true);
        assert.deepEqual(readState(statePath), validState({ track: "quick" }));
    } finally {
        fs.rmSync(home, { recursive: true, force: true });
    }
});

test("collectActiveStates excludes committed and sorts by mtime desc", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "wg-store-home-"));
    try {
        const pwd = "/repo/app";
        const oldDir = createFeature(pwd, "old", { date: "2026-06-20", track: "standard" }, home);
        const committedDir = createFeature(pwd, "done", { date: "2026-06-21", track: "standard" }, home);
        const newDir = createFeature(pwd, "new", { date: "2026-06-22", track: "standard" }, home);

        const oldState = path.join(oldDir, "state.json");
        const committedState = path.join(committedDir, "state.json");
        const newState = path.join(newDir, "state.json");

        setStateField(committedState, "phase", "committed");
        fs.utimesSync(oldState, new Date("2026-06-20T00:00:00Z"), new Date("2026-06-20T00:00:00Z"));
        fs.utimesSync(newState, new Date("2026-06-22T00:00:00Z"), new Date("2026-06-22T00:00:00Z"));
        fs.utimesSync(committedState, new Date("2026-06-23T00:00:00Z"), new Date("2026-06-23T00:00:00Z"));

        const active = collectActiveStates(pwd, home);
        assert.deepEqual(active.map((entry) => entry.state.slug), ["new", "old"]);
    } finally {
        fs.rmSync(home, { recursive: true, force: true });
    }
});

test("findState resolves by slug, sole active, and returns null for ambiguous/absent", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "wg-store-home-"));
    try {
        const pwd = "/repo/app";
        createFeature(pwd, "one", { date: "2026-06-20", track: "standard" }, home);
        const twoDir = createFeature(pwd, "two", { date: "2026-06-21", track: "standard" }, home);
        assert.equal(findState(pwd, "two", home)?.state.slug, "two");
        assert.equal(findState(pwd, undefined, home), null);

        setStateField(path.join(twoDir, "state.json"), "phase", "committed");
        assert.equal(findState(pwd, undefined, home)?.state.slug, "one");
        assert.equal(findState("/repo/other", undefined, home), null);
    } finally {
        fs.rmSync(home, { recursive: true, force: true });
    }
});

test("setStateField writes valid changes and rejects invalid ones without mutation", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "wg-store-home-"));
    try {
        const pwd = "/repo/app";
        const dir = createFeature(pwd, "change", { date: "2026-06-20", track: "standard" }, home);
        const statePath = path.join(dir, "state.json");

        const changed = setStateField(statePath, "phase", "planned");
        assert.equal(changed.phase, "planned");
        assert.equal(readState(statePath).phase, "planned");

        const before = fs.readFileSync(statePath, "utf8");
        assert.throws(() => setStateField(statePath, "phase", "bad-phase"), /"phase"/);
        const after = fs.readFileSync(statePath, "utf8");
        assert.equal(after, before);
    } finally {
        fs.rmSync(home, { recursive: true, force: true });
    }
});

test("collectActiveStates skips corrupt sibling state.json files", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "wg-store-home-"));
    try {
        const pwd = "/repo/app";
        createFeature(pwd, "healthy", { date: "2026-06-20", track: "standard" }, home);
        const corruptDir = createFeature(pwd, "corrupt", { date: "2026-06-21", track: "standard" }, home);
        fs.writeFileSync(path.join(corruptDir, "state.json"), '{"phase":"spec"# bad}', "utf8");

        const active = collectActiveStates(pwd, home);
        assert.deepEqual(active.map((entry) => entry.state.slug), ["healthy"]);
    } finally {
        fs.rmSync(home, { recursive: true, force: true });
    }
});

test("findState with explicit corrupt slug throws loudly", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "wg-store-home-"));
    try {
        const pwd = "/repo/app";
        createFeature(pwd, "healthy", { date: "2026-06-20", track: "standard" }, home);
        const corruptDir = createFeature(pwd, "corrupt", { date: "2026-06-21", track: "standard" }, home);
        fs.writeFileSync(path.join(corruptDir, "state.json"), '{"phase":"spec"# bad}', "utf8");

        assert.throws(() => findState(pwd, "corrupt", home), /Invalid state for slug "corrupt"/);
    } finally {
        fs.rmSync(home, { recursive: true, force: true });
    }
});

test("handleApproval records correct approval when phase matches and is idempotent", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "wg-store-home-"));
    try {
        const pwd = "/repo/app";
        const dir = createFeature(pwd, "dark-mode", { date: "2026-06-20", track: "standard" }, home);
        setStateField(path.join(dir, "state.json"), "phase", "planned");

        const first = handleApproval("approve plan", pwd, home);
        assert.match(first.context, /approved_plan/);
        const stateAfterFirst = readState(path.join(dir, "state.json"));
        assert.match(stateAfterFirst.approved_plan, /^\d{4}-\d{2}-\d{2}$/);

        const second = handleApproval("approve plan", pwd, home);
        assert.match(second.context, /already approved/);
        const stateAfterSecond = readState(path.join(dir, "state.json"));
        assert.equal(stateAfterSecond.approved_plan, stateAfterFirst.approved_plan);
    } finally {
        fs.rmSync(home, { recursive: true, force: true });
    }
});

test("handleApproval bare approve/go/ok use current phase for sole active feature", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "wg-store-home-"));
    try {
        const pwd = "/repo/app";

        const specDir = createFeature(pwd, "spec-only", { date: "2026-06-20", track: "standard" }, home);
        const specStatePath = path.join(specDir, "state.json");
        const specResult = handleApproval("approve", pwd, home);
        assert.match(specResult.context, /approved_spec/);
        assert.match(readState(specStatePath).approved_spec, /^\d{4}-\d{2}-\d{2}$/);

        setStateField(specStatePath, "phase", "committed");

        const planDir = createFeature(pwd, "plan-only", { date: "2026-06-21", track: "standard" }, home);
        const planStatePath = path.join(planDir, "state.json");
        setStateField(planStatePath, "phase", "planned");

        const goResult = handleApproval("go", pwd, home);
        assert.match(goResult.context, /approved_plan/);
        assert.match(readState(planStatePath).approved_plan, /^\d{4}-\d{2}-\d{2}$/);

        setStateField(planStatePath, "phase", "committed");

        const implDir = createFeature(pwd, "impl-only", { date: "2026-06-22", track: "standard" }, home);
        const implStatePath = path.join(implDir, "state.json");
        setStateField(implStatePath, "phase", "implemented");

        const okResult = handleApproval("ok", pwd, home);
        assert.match(okResult.context, /approved_implementation/);
        assert.match(readState(implStatePath).approved_implementation, /^\d{4}-\d{2}-\d{2}$/);
    } finally {
        fs.rmSync(home, { recursive: true, force: true });
    }
});

test("handleApproval verb plus slug uses named active feature current phase", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "wg-store-home-"));
    try {
        const pwd = "/repo/app";
        const aDir = createFeature(pwd, "alpha", { date: "2026-06-20", track: "standard" }, home);
        const bDir = createFeature(pwd, "beta", { date: "2026-06-21", track: "standard" }, home);
        const cDir = createFeature(pwd, "gamma", { date: "2026-06-22", track: "standard" }, home);
        const aStatePath = path.join(aDir, "state.json");
        const bStatePath = path.join(bDir, "state.json");
        const cStatePath = path.join(cDir, "state.json");
        setStateField(aStatePath, "phase", "planned");
        setStateField(bStatePath, "phase", "implemented");
        setStateField(cStatePath, "phase", "reviewed");

        const approveResult = handleApproval("approve alpha", pwd, home);
        assert.match(approveResult.context, /approved_plan/);
        assert.match(readState(aStatePath).approved_plan, /^\d{4}-\d{2}-\d{2}$/);

        const goResult = handleApproval("go beta", pwd, home);
        assert.match(goResult.context, /approved_implementation/);
        assert.match(readState(bStatePath).approved_implementation, /^\d{4}-\d{2}-\d{2}$/);

        const okResult = handleApproval("ok gamma", pwd, home);
        assert.match(okResult.context, /approved_review/);
        assert.match(readState(cStatePath).approved_review, /^\d{4}-\d{2}-\d{2}$/);
    } finally {
        fs.rmSync(home, { recursive: true, force: true });
    }
});

test("handleApproval bare verb disambiguates for multiple active features", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "wg-store-home-"));
    try {
        const pwd = "/repo/app";
        const aDir = createFeature(pwd, "a", { date: "2026-06-20", track: "standard" }, home);
        const bDir = createFeature(pwd, "b", { date: "2026-06-21", track: "standard" }, home);
        const aStatePath = path.join(aDir, "state.json");
        const bStatePath = path.join(bDir, "state.json");
        setStateField(aStatePath, "phase", "planned");
        setStateField(bStatePath, "phase", "planned");

        const result = handleApproval("approve", pwd, home);
        assert.match(result.context, /Multiple active features/);
        assert.equal(readState(aStatePath).approved_plan, "");
        assert.equal(readState(bStatePath).approved_plan, "");
    } finally {
        fs.rmSync(home, { recursive: true, force: true });
    }
});

test("handleApproval returns guidance for phase mismatch, malformed input, and ambiguous slug", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "wg-store-home-"));
    try {
        const pwd = "/repo/app";
        createFeature(pwd, "a", { date: "2026-06-20", track: "standard" }, home);
        createFeature(pwd, "b", { date: "2026-06-21", track: "standard" }, home);

        assert.match(handleApproval("approve plan", pwd, home).context, /Multiple active features/);
        assert.match(handleApproval("approve maybe nope", pwd, home).context, /Use:/);
        assert.match(handleApproval("approve plan a", pwd, home).context, /requires "planned"/);
    } finally {
        fs.rmSync(home, { recursive: true, force: true });
    }
});

test("handleApproval gate-first resolves known gate token as explicit step", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "wg-store-home-"));
    try {
        const pwd = "/repo/app";
        const dir = createFeature(pwd, "feature", { date: "2026-06-20", track: "standard" }, home);
        const statePath = path.join(dir, "state.json");
        setStateField(statePath, "phase", "planned");

        const explicit = handleApproval("approve spec", pwd, home);
        assert.match(explicit.context, /requires "spec"/);
        assert.equal(readState(statePath).approved_spec, "");
    } finally {
        fs.rmSync(home, { recursive: true, force: true });
    }
});

test("handleApproval gate-first resolves non-gate token as slug", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "wg-store-home-"));
    try {
        const pwd = "/repo/app";
        const targetDir = createFeature(
            pwd,
            "some-slug",
            { date: "2026-06-20", track: "standard" },
            home,
        );
        const otherDir = createFeature(pwd, "other", { date: "2026-06-21", track: "standard" }, home);
        const targetStatePath = path.join(targetDir, "state.json");
        const otherStatePath = path.join(otherDir, "state.json");
        setStateField(targetStatePath, "phase", "planned");
        setStateField(otherStatePath, "phase", "implemented");

        const result = handleApproval("approve some-slug", pwd, home);
        assert.match(result.context, /some-slug/);
        assert.match(readState(targetStatePath).approved_plan, /^\d{4}-\d{2}-\d{2}$/);
        assert.equal(readState(otherStatePath).approved_implementation, "");
    } finally {
        fs.rmSync(home, { recursive: true, force: true });
    }
});

test("handleReopen clears target and later approvals and resets phase", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "wg-store-home-"));
    try {
        const pwd = "/repo/app";
        const dir = createFeature(pwd, "a", { date: "2026-06-20", track: "standard" }, home);
        const statePath = path.join(dir, "state.json");
        writeState(statePath, {
            ...readState(statePath),
            phase: "reviewed",
            approved_spec: "2026-06-20",
            approved_plan: "2026-06-21",
            approved_implementation: "2026-06-22",
            approved_review: "2026-06-23",
            approved_docs: "2026-06-24",
        });

        const result = handleReopen("reopen plan", pwd, home);
        assert.match(result.context, /Reopened "plan"/);
        const state = readState(statePath);
        assert.equal(state.phase, "planned");
        assert.equal(state.approved_spec, "2026-06-20");
        assert.equal(state.approved_plan, "");
        assert.equal(state.approved_implementation, "");
        assert.equal(state.approved_review, "");
        assert.equal(state.approved_docs, "");
    } finally {
        fs.rmSync(home, { recursive: true, force: true });
    }
});

test("handleReopen refuses not-yet-reached step", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "wg-store-home-"));
    try {
        const pwd = "/repo/app";
        createFeature(pwd, "a", { date: "2026-06-20", track: "standard" }, home);
        const result = handleReopen("reopen review a", pwd, home);
        assert.match(result.context, /has not been reached/);
    } finally {
        fs.rmSync(home, { recursive: true, force: true });
    }
});

test("handleDispatchGate denies when approval missing and allows when present", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "wg-store-home-"));
    try {
        const pwd = "/repo/app";
        const dir = createFeature(pwd, "a", { date: "2026-06-20", track: "standard" }, home);
        const statePath = path.join(dir, "state.json");

        const denied = handleDispatchGate("implementer", "a", pwd, home);
        assert.equal(denied.deny, true);
        assert.match(denied.reason, /approved_plan/);

        setStateField(statePath, "approved_plan", "2026-06-24");
        const allowed = handleDispatchGate("implementer", "a", pwd, home);
        assert.deepEqual(allowed, { deny: false });

        assert.deepEqual(handleDispatchGate("orchestrator", "a", pwd, home), { deny: false });
    } finally {
        fs.rmSync(home, { recursive: true, force: true });
    }
});

test("non-approval and non-reopen prompts return null", () => {
    assert.equal(handleApproval("hello"), null);
    assert.equal(handleReopen("hello"), null);
});

test("approve design is passthrough and returns null", () => {
    assert.equal(handleApproval("approve design"), null);
});

test("approve/go/ok design forms are passthrough and return null", () => {
    assert.equal(handleApproval("approve design"), null);
    assert.equal(handleApproval("approve design alpha"), null);
    assert.equal(handleApproval("go design"), null);
    assert.equal(handleApproval("go design alpha"), null);
    assert.equal(handleApproval("ok design"), null);
    assert.equal(handleApproval("ok design alpha"), null);
});

test("bare approval verb with no active feature returns no active feature message", () => {
    const result = handleApproval("approve", "/repo/app", "/home/no-such-home-for-tests");
    assert.match(result.context, /No active feature found/);
});

test("go/ok anchored forms do not trigger approval in longer messages", () => {
    assert.equal(handleApproval("ok let's go"), null);
    assert.equal(handleApproval("go ahead and build it"), null);
});

function runStoreCli(args, { home, cwd }) {
    return spawnSync(
        process.execPath,
        [path.join(process.cwd(), ".github/extensions/workflow-gate/store.mjs"), ...args],
        {
            cwd,
            env: { ...process.env, HOME: home },
            encoding: "utf8",
        },
    );
}

test("CLI create then path/get reflect the feature", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "wg-store-home-"));
    const cwd = process.cwd();
    try {
        const create = runStoreCli(["create", "cli-feature"], { home, cwd });
        assert.equal(create.status, 0);
        assert.match(create.stdout, /cli-feature/);

        const pathCmd = runStoreCli(["path"], { home, cwd });
        assert.equal(pathCmd.status, 0);
        assert.match(pathCmd.stdout, /cli-feature/);

        const getCmd = runStoreCli(["get"], { home, cwd });
        assert.equal(getCmd.status, 0);
        assert.match(getCmd.stdout, /"slug": "cli-feature"/);
    } finally {
        fs.rmSync(home, { recursive: true, force: true });
    }
});

test("CLI set phase planned persists valid change", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "wg-store-home-"));
    const cwd = process.cwd();
    try {
        assert.equal(runStoreCli(["create", "cli-set"], { home, cwd }).status, 0);
        const setCmd = runStoreCli(["set", "phase", "planned"], { home, cwd });
        assert.equal(setCmd.status, 0);
        assert.match(setCmd.stdout, /"phase": "planned"/);
        const getCmd = runStoreCli(["get"], { home, cwd });
        assert.match(getCmd.stdout, /"phase": "planned"/);
    } finally {
        fs.rmSync(home, { recursive: true, force: true });
    }
});

test("CLI invalid set exits non-zero with field in stderr", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "wg-store-home-"));
    const cwd = process.cwd();
    try {
        assert.equal(runStoreCli(["create", "cli-invalid"], { home, cwd }).status, 0);
        const bad = runStoreCli(["set", "phase", "nope"], { home, cwd });
        assert.notEqual(bad.status, 0);
        assert.match(bad.stderr, /"phase"/);
    } finally {
        fs.rmSync(home, { recursive: true, force: true });
    }
});

test("CLI path/get with no active feature exit non-zero", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "wg-store-home-"));
    const cwd = process.cwd();
    try {
        const pathCmd = runStoreCli(["path"], { home, cwd });
        const getCmd = runStoreCli(["get"], { home, cwd });
        assert.notEqual(pathCmd.status, 0);
        assert.notEqual(getCmd.status, 0);
    } finally {
        fs.rmSync(home, { recursive: true, force: true });
    }
});

test("CLI list shows active features", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "wg-store-home-"));
    const cwd = process.cwd();
    try {
        assert.equal(runStoreCli(["create", "cli-list"], { home, cwd }).status, 0);
        const listCmd = runStoreCli(["list"], { home, cwd });
        assert.equal(listCmd.status, 0);
        assert.match(listCmd.stdout, /^cli-list\t/m);
    } finally {
        fs.rmSync(home, { recursive: true, force: true });
    }
});

test("importing store.mjs does not execute CLI", () => {
    const imported = spawnSync(
        process.execPath,
        [
            "--input-type=module",
            "-e",
            `import(${JSON.stringify(path.join(process.cwd(), ".github/extensions/workflow-gate/store.mjs"))});`,
        ],
        { encoding: "utf8" },
    );
    assert.equal(imported.status, 0);
    assert.equal(imported.stdout, "");
    assert.equal(imported.stderr, "");
});
