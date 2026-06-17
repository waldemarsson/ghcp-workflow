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
// implement + review share the approved_plan gate (review auto-follows implement,
// no extra human stop). documenter waits for the human's review sign-off.
const REQUIRED_APPROVAL = {
    implementer: "approved_plan",
    reviewer: "approved_plan",
    "documenter": "approved_review",
};

// When the human approves, the just-completed `phase` maps to this approval key.
const PHASE_TO_APPROVAL = {
    spec: "approved_spec",
    planned: "approved_plan",
    reviewed: "approved_review",
    documented: "approved_docs",
};

const APPROVE_WORDS = new Set(["approve", "approved", "continue", "lgtm"]);
const FEATURES_DIR = "docs/features";

function findActiveStatePath(cwd) {
    const base = join(cwd, FEATURES_DIR);
    if (!existsSync(base)) return null;
    let best = null;
    let bestM = -1;
    for (const d of readdirSync(base)) {
        const p = join(base, d, "state.yml");
        if (!existsSync(p)) continue;
        const txt = readFileSync(p, "utf8");
        const phase = (txt.match(/^phase:\s*(.*)$/m) || [])[1]?.trim();
        if (phase === "committed") continue; // feature already done
        const m = statSync(p).mtimeMs;
        if (m > bestM) {
            bestM = m;
            best = p;
        }
    }
    return best;
}

function parseState(txt) {
    const o = {};
    for (const line of txt.split(/\r?\n/)) {
        const m = line.match(/^([a-z_]+):\s*(.*)$/);
        if (m) o[m[1]] = m[2].trim();
    }
    return o;
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
        // Record a gate approval when the human types "approve".
        onUserPromptSubmitted: async (input) => {
            const word = input.prompt.trim().toLowerCase();
            if (!APPROVE_WORDS.has(word)) return;

            const sp = findActiveStatePath(input.cwd);
            if (!sp) return;

            let txt = readFileSync(sp, "utf8");
            const st = parseState(txt);
            const key = PHASE_TO_APPROVAL[st.phase];
            if (!key) return; // nothing to approve at this phase
            if (st[key]) return; // already approved

            const date = new Date().toISOString().slice(0, 10);
            txt = setKey(txt, key, date);
            writeFileSync(sp, txt);
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

            const sp = findActiveStatePath(input.cwd);
            let approved = false;
            let slug = "(no active feature)";
            if (sp) {
                const st = parseState(readFileSync(sp, "utf8"));
                slug = st.slug || slug;
                approved = Boolean(st[reqKey]);
            }

            if (!approved) {
                const reason = `[workflow-gate] Cannot start "${at}" for ${slug}: the gate "${reqKey}" is not approved yet. The previous phase must be reviewed and approved (type "approve") before continuing.`;
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
