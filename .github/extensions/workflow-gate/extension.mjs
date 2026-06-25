import { joinSession } from "@github/copilot-sdk/extension";
import {
    extractSlugFromText,
    handleApproval,
    handleDispatchGate,
    handleReopen,
} from "./store.mjs";

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
        onUserPromptSubmitted: async (input) => {
            const cwd = input.workingDirectory ?? input.cwd ?? process.cwd();
            const reopen = handleReopen(input.prompt, cwd);
            if (reopen) {
                await session.log(reopen.context);
                return { additionalContext: reopen.context };
            }

            const approval = handleApproval(input.prompt, cwd);
            if (approval) {
                await session.log(approval.context);
                return { additionalContext: approval.context };
            }
        },
        onPreToolUse: async (input) => {
            if (input.toolName !== "task") return;
            const args = normalizeArgs(input.toolArgs);
            const agentType = args.agent_type;
            const slugHint = extractSlugFromText(
                [args.prompt, args.description, args.name]
                    .filter((value) => typeof value === "string")
                    .join("\n"),
            );
            const cwd = input.workingDirectory ?? input.cwd ?? process.cwd();
            const decision = handleDispatchGate(agentType, slugHint, cwd);
            if (decision.deny) {
                await session.log(decision.reason, { level: "warning" });
                return {
                    permissionDecision: "deny",
                    permissionDecisionReason: decision.reason,
                };
            }
        },
    },
});

await session.log("workflow-gate ready — phase gates enforced.");
