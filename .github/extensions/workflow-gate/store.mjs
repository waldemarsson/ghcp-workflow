import { createHash } from "node:crypto";
import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    statSync,
    writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function projectSlug(pwd = process.cwd()) {
    const base = path.basename(pwd);
    const hash = createHash("sha256").update(String(pwd)).digest("hex").slice(0, 8);
    return `${base}-${hash}`;
}

export function projectRoot(pwd = process.cwd(), home = os.homedir()) {
    return path.join(home, ".copilot", "workflow", "features", projectSlug(pwd));
}

export function featureDir(pwd, slug, date, home = os.homedir()) {
    return path.join(projectRoot(pwd, home), `${date}-${slug}`);
}

export function extractSlugFromText(text) {
    if (typeof text !== "string") return null;
    const match = text.match(
        /(?:^|[\\/])workflow[\\/]features[\\/][^\\/]+[\\/]\d{4}-\d{2}-\d{2}-([a-z0-9][a-z0-9-]*)(?:[\\/]|$)/i,
    );
    return match?.[1] ?? null;
}

const KNOWN_KEYS = new Set([
    "slug",
    "track",
    "phase",
    "approved_spec",
    "approved_plan",
    "approved_implementation",
    "approved_review",
    "approved_docs",
]);

const APPROVAL_KEYS = [
    "approved_spec",
    "approved_plan",
    "approved_implementation",
    "approved_review",
    "approved_docs",
];
const APPROVAL_COMMANDS = {
    spec: { phase: "spec", key: "approved_spec" },
    plan: { phase: "planned", key: "approved_plan" },
    implementation: { phase: "implemented", key: "approved_implementation" },
    review: { phase: "reviewed", key: "approved_review" },
    docs: { phase: "documented", key: "approved_docs" },
};

const GATE_ORDER = ["spec", "plan", "implementation", "review", "docs"];

const APPROVE_HELP =
    'Use: "approve spec|plan|implementation|review|docs [slug]".';
const REOPEN_HELP =
    'Use: "reopen spec|plan|implementation|review|docs [slug]".';

const REQUIRED_APPROVAL = {
    implementer: "approved_plan",
    reviewer: "approved_implementation",
    documenter: "approved_review",
};

export const PHASE_SEQUENCE = [
    "spec",
    "planned",
    "implemented",
    "reviewed",
    "documented",
    "committed",
];

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateState(obj) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
        throw new Error("state must be an object");
    }

    for (const key of Object.keys(obj)) {
        if (!KNOWN_KEYS.has(key)) {
            throw new Error(`Invalid state field "${key}"`);
        }
    }

    if (obj.phase !== undefined && !PHASE_SEQUENCE.includes(obj.phase)) {
        throw new Error(`Invalid state field "phase": ${obj.phase}`);
    }

    if (obj.track !== undefined && obj.track !== "standard" && obj.track !== "quick") {
        throw new Error(`Invalid state field "track": ${obj.track}`);
    }

    for (const key of APPROVAL_KEYS) {
        const value = obj[key];
        if (value === undefined || value === "") continue;
        if (typeof value !== "string" || !ISO_DATE_RE.test(value)) {
            throw new Error(`Invalid state field "${key}": ${String(value)}`);
        }
    }
}

export function parseState(text) {
    try {
        const parsed = JSON.parse(text);
        validateState(parsed);
        return parsed;
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw new Error(`Failed to parse state JSON: ${error.message}`);
        }
        throw error;
    }
}

export function serializeState(obj) {
    validateState(obj);
    return `${JSON.stringify(obj, null, 2)}\n`;
}

export function readState(filePath) {
    return parseState(readFileSync(filePath, "utf8"));
}

export function writeState(filePath, obj) {
    writeFileSync(filePath, serializeState(obj), "utf8");
}

export function createFeature(
    pwd = process.cwd(),
    slug,
    { date, track = "standard" },
    home = os.homedir(),
) {
    const dir = featureDir(pwd, slug, date, home);
    mkdirSync(dir, { recursive: true });
    writeState(path.join(dir, "state.json"), {
        slug,
        track,
        phase: "spec",
        approved_spec: "",
        approved_plan: "",
        approved_implementation: "",
        approved_review: "",
        approved_docs: "",
    });
    return dir;
}

export function collectActiveStates(pwd = process.cwd(), home = os.homedir()) {
    const root = projectRoot(pwd, home);
    if (!existsSync(root)) return [];

    const states = [];
    for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const statePath = path.join(root, entry.name, "state.json");
        if (!existsSync(statePath)) continue;
        let state;
        try {
            state = readState(statePath);
        } catch {
            continue;
        }
        if (state.phase === "committed") continue;
        states.push({ path: statePath, state, mtime: statSync(statePath).mtimeMs });
    }
    return states.sort((a, b) => b.mtime - a.mtime);
}

export function findState(pwd = process.cwd(), slug, home = os.homedir()) {
    if (slug) {
        const root = projectRoot(pwd, home);
        if (!existsSync(root)) return null;
        for (const entry of readdirSync(root, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            const statePath = path.join(root, entry.name, "state.json");
            if (!existsSync(statePath)) continue;
            try {
                const state = readState(statePath);
                if (state.phase === "committed") continue;
                if (state.slug === slug) {
                    return { path: statePath, state, mtime: statSync(statePath).mtimeMs };
                }
            } catch (error) {
                if (entry.name.match(new RegExp(`^\\d{4}-\\d{2}-\\d{2}-${slug}$`))) {
                    throw new Error(
                        `Invalid state for slug "${slug}": ${error instanceof Error ? error.message : String(error)}`,
                    );
                }
            }
        }
        return null;
    }
    const states = collectActiveStates(pwd, home);
    return states.length === 1 ? states[0] : null;
}

export function setStateField(statePath, key, value) {
    const current = readState(statePath);
    const next = { ...current, [key]: value };
    validateState(next);
    writeState(statePath, next);
    return next;
}

function parseApprovalPrompt(prompt) {
    const trimmed = String(prompt ?? "").trim().toLowerCase();
    if (!trimmed.startsWith("approve")) return null;
    if (/^approve\s+design(?:\s+[a-z0-9][a-z0-9-]*)?$/.test(trimmed)) return null;
    const match = trimmed.match(
        /^approve\s+(spec|plan|implementation|review|docs)(?:\s+([a-z0-9][a-z0-9-]*))?$/,
    );
    if (!match) return { error: APPROVE_HELP };
    return { gate: match[1], slug: match[2] };
}

function parseReopenPrompt(prompt) {
    const trimmed = String(prompt ?? "").trim().toLowerCase();
    if (!trimmed.startsWith("reopen")) return null;
    const match = trimmed.match(
        /^reopen\s+(spec|plan|implementation|review|docs)(?:\s+([a-z0-9][a-z0-9-]*))?$/,
    );
    if (!match) return { error: REOPEN_HELP };
    return { gate: match[1], slug: match[2] };
}

function activeFeatureError(states, slug, help, command) {
    if (states.length > 1 && !slug) {
        return `Multiple active features found; include the slug in "${command}" command. ${help}`;
    }
    return `No active feature${slug ? ` with slug "${slug}"` : ""} found.`;
}

export function handleApproval(prompt, pwd = process.cwd(), home = os.homedir()) {
    const approval = parseApprovalPrompt(prompt);
    if (!approval) return null;
    if (approval.error) return { context: approval.error };

    const states = collectActiveStates(pwd, home);
    let active;
    if (approval.slug) {
        active = states.find((entry) => entry.state.slug === approval.slug) ?? null;
        if (!active) {
            active = findState(pwd, approval.slug, home);
        }
    } else {
        active = states.length === 1 ? states[0] : null;
    }
    if (!active) {
        return {
            context: activeFeatureError(states, approval.slug, APPROVE_HELP, "approve"),
        };
    }

    const expected = APPROVAL_COMMANDS[approval.gate];
    if (active.state.phase !== expected.phase) {
        return {
            context: `Cannot record "${approval.gate}" approval for "${active.state.slug}": current phase is "${active.state.phase}" but "${approval.gate}" requires "${expected.phase}".`,
        };
    }

    if (active.state[expected.key]) {
        return {
            context: `Gate "${expected.key}" for "${active.state.slug}" is already approved.`,
        };
    }

    const next = { ...active.state, [expected.key]: new Date().toISOString().slice(0, 10) };
    writeState(active.path, next);
    return {
        context: `Gate "${expected.key}" approved for feature "${active.state.slug}".`,
    };
}

export function handleReopen(prompt, pwd = process.cwd(), home = os.homedir()) {
    const reopen = parseReopenPrompt(prompt);
    if (!reopen) return null;
    if (reopen.error) return { context: reopen.error };

    const states = collectActiveStates(pwd, home);
    let active;
    if (reopen.slug) {
        active = states.find((entry) => entry.state.slug === reopen.slug) ?? null;
        if (!active) {
            active = findState(pwd, reopen.slug, home);
        }
    } else {
        active = states.length === 1 ? states[0] : null;
    }
    if (!active) {
        return {
            context: activeFeatureError(states, reopen.slug, REOPEN_HELP, "reopen"),
        };
    }

    const target = APPROVAL_COMMANDS[reopen.gate];
    const currentPhaseIndex = PHASE_SEQUENCE.indexOf(active.state.phase);
    const targetPhaseIndex = PHASE_SEQUENCE.indexOf(target.phase);
    if (targetPhaseIndex < 0 || currentPhaseIndex < 0 || targetPhaseIndex > currentPhaseIndex) {
        return {
            context: `Cannot reopen "${reopen.gate}" for "${active.state.slug}": that step has not been reached (current phase "${active.state.phase}").`,
        };
    }

    const next = { ...active.state, phase: target.phase };
    for (const gate of GATE_ORDER.slice(GATE_ORDER.indexOf(reopen.gate))) {
        next[APPROVAL_COMMANDS[gate].key] = "";
    }
    writeState(active.path, next);
    return {
        context: `Reopened "${reopen.gate}" for "${active.state.slug}".`,
    };
}

export function handleDispatchGate(
    agentType,
    slugHint,
    pwd = process.cwd(),
    home = os.homedir(),
) {
    const required = REQUIRED_APPROVAL[agentType];
    if (!required) return { deny: false };
    const active = findState(pwd, slugHint, home);
    if (!active || !active.state[required]) {
        const slug = active?.state?.slug ?? "(no active feature)";
        return {
            deny: true,
            reason: `[workflow-gate] Cannot start "${agentType}" for ${slug}: gate "${required}" is not approved yet.`,
        };
    }
    return { deny: false };
}

function parseCliArgs(argv) {
    const args = [...argv];
    let slug;
    let track = "standard";

    const readFlagValue = (flag, index) => {
        if (index + 1 >= args.length) {
            throw new Error(`Missing value for ${flag}`);
        }
        return args[index + 1];
    };

    for (let i = 0; i < args.length; i += 1) {
        if (args[i] === "--slug") {
            slug = readFlagValue("--slug", i);
            args.splice(i, 2);
            i -= 1;
        } else if (args[i] === "--track") {
            track = readFlagValue("--track", i);
            args.splice(i, 2);
            i -= 1;
        }
    }

    return { args, slug, track };
}

function resolveActiveFeature(pwd, home, slug) {
    const found = findState(pwd, slug, home);
    if (!found) {
        throw new Error(slug ? `No active feature with slug "${slug}"` : "No active feature found");
    }
    return found;
}

export function main(argv = process.argv.slice(2), pwd = process.cwd(), home = os.homedir()) {
    const { args, slug, track } = parseCliArgs(argv);
    const [cmd, ...rest] = args;
    switch (cmd) {
        case "root":
            process.stdout.write(`${projectRoot(pwd, home)}\n`);
            return;
        case "create": {
            const featureSlug = rest[0];
            if (!featureSlug) throw new Error("create requires <slug>");
            const dir = createFeature(
                pwd,
                featureSlug,
                { date: new Date().toISOString().slice(0, 10), track },
                home,
            );
            process.stdout.write(`${dir}\n`);
            return;
        }
        case "path": {
            const found = resolveActiveFeature(pwd, home, slug);
            process.stdout.write(`${path.dirname(found.path)}\n`);
            return;
        }
        case "get": {
            const found = resolveActiveFeature(pwd, home, slug);
            process.stdout.write(serializeState(found.state));
            return;
        }
        case "set": {
            const [key, value] = rest;
            if (!key || value === undefined) throw new Error("set requires <key> <value>");
            const found = resolveActiveFeature(pwd, home, slug);
            const next = setStateField(found.path, key, value);
            process.stdout.write(serializeState(next));
            return;
        }
        case "list": {
            const list = collectActiveStates(pwd, home);
            for (const entry of list) {
                process.stdout.write(
                    `${entry.state.slug}\t${entry.state.phase}\t${path.dirname(entry.path)}\n`,
                );
            }
            return;
        }
        default:
            throw new Error(
                "Unknown command. Use: root | create <slug> [--track ...] | path [--slug s] | get [--slug s] | set <key> <value> [--slug s] | list",
            );
    }
}

const isCliEntrypoint =
    process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isCliEntrypoint) {
    try {
        main();
    } catch (error) {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exit(1);
    }
}
