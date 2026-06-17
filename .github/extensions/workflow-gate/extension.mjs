import { joinSession } from "@github/copilot-sdk/extension";
import {
    readFileSync,
    writeFileSync,
    existsSync,
    readdirSync,
    statSync,
} from "node:fs";
import { join } from "node:path";

// Phase specialist agent_types this gate governs (dispatched subagents only).
const PHASES = ["implementer", "reviewer", "documenter"];

// To DISPATCH this agent, this approval key in state.yml must be set.
// Each autonomous phase has its own human approval gate.
const REQUIRED_APPROVAL = {
    implementer: "approved_plan",
    reviewer: "approved_implementation",
    documenter: "approved_review",
};

// When the human approves, the just-completed `phase` maps to this approval key.
const PHASE_TO_APPROVAL = {
    spec: "approved_spec",
    planned: "approved_plan",
    implemented: "approved_implementation",
    reviewed: "approved_review",
    documented: "approved_docs",
};

const APPROVAL_COMMANDS = {
    spec: { phase: "spec", key: "approved_spec" },
    plan: { phase: "planned", key: "approved_plan" },
    implementation: { phase: "implemented", key: "approved_implementation" },
    review: { phase: "reviewed", key: "approved_review" },
    docs: { phase: "documented", key: "approved_docs" },
};
const APPROVE_HELP =
    'Use an exact approval command: "approve spec", "approve plan", "approve implementation", "approve review", or "approve docs". Add the feature slug when more than one feature is active, e.g. "approve plan dark-mode".';
const FEATURES_DIR = "docs/features";

function collectActiveStates(cwd) {
    const base = join(cwd, FEATURES_DIR);
    if (!existsSync(base)) return [];
    const states = [];
    for (const d of readdirSync(base)) {
        const p = join(base, d, "state.yml");
        if (!existsSync(p)) continue;
        const txt = readFileSync(p, "utf8");
        const state = parseState(txt);
        if (state.phase === "committed") continue; // feature already done
        states.push({ path: p, state, mtime: statSync(p).mtimeMs });
    }
    return states.sort((a, b) => b.mtime - a.mtime);
}

function findState(cwd, slug) {
    const states = collectActiveStates(cwd);
    if (slug) return states.find((s) => s.state.slug === slug) ?? null;
    if (states.length === 1) return states[0];
    return null;
}

function parseState(txt) {
    const o = {};
    for (const line of txt.split(/\r?\n/)) {
        const m = line.match(/^([a-z_]+):\s*(.*)$/);
        if (m) o[m[1]] = m[2].trim();
    }
    return o;
}

function parseApprovalPrompt(prompt) {
    const trimmed = prompt.trim().toLowerCase();
    if (!trimmed.startsWith("approve")) return null;
    if (/^approve\s+design(?:\s+[a-z0-9][a-z0-9-]*)?$/.test(trimmed)) return null;
    const match = trimmed.match(/^approve\s+(spec|plan|implementation|review|docs)(?:\s+([a-z0-9][a-z0-9-]*))?$/);
    if (!match) return { error: APPROVE_HELP };
    return { gate: match[1], slug: match[2] };
}

function extractSlugFromArgs(args) {
    const text = [args.prompt, args.description, args.name]
        .filter((value) => typeof value === "string")
        .join("\n");
    return text.match(/docs\/features\/([a-z0-9][a-z0-9-]*)\//i)?.[1] ?? null;
}

function setKey(txt, key, val) {
    const re = new RegExp(`^${key}:.*$`, "m");
    if (re.test(txt)) return txt.replace(re, `${key}: ${val}`);
    return `${txt.replace(/\s*$/, "")}\n${key}: ${val}\n`;
}

function normalizeArgs(toolArgs) {
    if (toolArgs && typeof toolArgs === "object") return toolArgs;
    if (typeof toolArgs === "string") {
        try {
            return JSON.parse(toolArgs);
        } catch {
            return {};
        }
    }
    return {};
}

const session = await joinSession({
    hooks: {
        // Record a gate approval only for exact commands like "approve plan".
        onUserPromptSubmitted: async (input) => {
            const approval = parseApprovalPrompt(input.prompt);
            if (!approval) return;
            if (approval.error) {
                await session.log(`workflow-gate: ${approval.error}`, { level: "warning" });
                return { additionalContext: `[workflow-gate] ${approval.error}` };
            }

            const cwd = input.workingDirectory ?? input.cwd ?? process.cwd();
            const states = collectActiveStates(cwd);
            const active = findState(cwd, approval.slug);
            if (!active) {
                const reason =
                    states.length > 1 && !approval.slug
                        ? `Multiple active features found; include the slug in the approval command. ${APPROVE_HELP}`
                        : `No active feature${approval.slug ? ` with slug "${approval.slug}"` : ""} found.`;
                await session.log(`workflow-gate: ${reason}`, { level: "warning" });
                return { additionalContext: `[workflow-gate] ${reason}` };
            }

            const expected = APPROVAL_COMMANDS[approval.gate];
            if (active.state.phase !== expected.phase) {
                const reason = `Cannot record "${approval.gate}" approval for "${active.state.slug}": state.yml is at phase "${active.state.phase}", expected "${expected.phase}".`;
                await session.log(`workflow-gate: ${reason}`, { level: "warning" });
                return { additionalContext: `[workflow-gate] ${reason}` };
            }

            let txt = readFileSync(active.path, "utf8");
            const st = parseState(txt);
            const key = PHASE_TO_APPROVAL[st.phase];
            if (!key) return; // nothing to approve at this phase
            if (st[key]) return; // already approved

            const date = new Date().toISOString().slice(0, 10);
            txt = setKey(txt, key, date);
            writeFileSync(active.path, txt);
            await session.log(
                `workflow-gate: recorded ${key} for "${st.slug}" — next phase unlocked.`,
            );
            return {
                additionalContext: `[workflow-gate] Gate "${key}" approved for feature "${st.slug}". The orchestrator may now dispatch the next phase.`,
            };
        },

        // Hard-block dispatching a phase whose previous gate is not approved.
        onPreToolUse: async (input) => {
            if (input.toolName !== "task") return;
            const args = normalizeArgs(input.toolArgs);
            const at = args.agent_type;
            if (!PHASES.includes(at)) return; // not a workflow phase

            const reqKey = REQUIRED_APPROVAL[at];
            if (!reqKey) return; // spec — always allowed

            const cwd = input.workingDirectory ?? input.cwd ?? process.cwd();
            const slugFromPrompt = extractSlugFromArgs(args);
            const active = findState(cwd, slugFromPrompt);
            let approved = false;
            let slug = "(no active feature)";
            if (active) {
                const st = parseState(readFileSync(active.path, "utf8"));
                slug = st.slug || slug;
                approved = Boolean(st[reqKey]);
            }

            if (!approved) {
                const reason = `[workflow-gate] Cannot start "${at}" for ${slug}: the gate "${reqKey}" is not approved yet. The previous phase must be reviewed and approved with an exact command before continuing.`;
                await session.log(reason, { level: "warning" });
                return {
                    permissionDecision: "deny",
                    permissionDecisionReason: reason,
                };
            }
        },
    },
});

await session.log("workflow-gate ready — phase gates enforced.");
