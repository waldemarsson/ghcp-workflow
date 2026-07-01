#!/usr/bin/env bash
#
# Deploy the workflow into ~/.copilot so the agents, gate extension, and workflow
# assets are available globally in the Copilot CLI.
#
# The repo root mirrors ~/.copilot one-to-one, so deploying is just copying the three
# managed directories:
#
#   agents/      -> ~/.copilot/agents/
#   extensions/  -> ~/.copilot/extensions/
#   workflow/    -> ~/.copilot/workflow/
#
# .github/copilot-instructions.md is repo-local guidance and is NOT deployed.
#
# The copy is additive/overwrite: it never deletes files at the destination. This is
# deliberate — ~/.copilot/workflow/ also holds live per-feature state under features/,
# which must never be touched by a deploy.
#
# Usage:
#   ./deploy.sh            Copy/overwrite the managed dirs into ~/.copilot.
#   ./deploy.sh --dry-run  Show what would change without writing anything.
#
set -euo pipefail

DIRS=(agents extensions workflow)
DEST="${HOME}/.copilot"

DRY_RUN=0
for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=1 ;;
        -h|--help)
            sed -n '2,21p' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *)
            echo "Unknown option: $arg (use --dry-run or --help)" >&2
            exit 2
            ;;
    esac
done

# Run from the repo root (the directory this script lives in).
cd "$(dirname "$0")"

mkdir -p "$DEST"

if command -v rsync >/dev/null 2>&1; then
    rsync_flags=(-a --exclude='.DS_Store')
    (( DRY_RUN )) && rsync_flags+=(--dry-run --itemize-changes)
    for dir in "${DIRS[@]}"; do
        # Trailing slash on source copies the dir's *contents* into DEST/<dir>/.
        rsync "${rsync_flags[@]}" "${dir}/" "${DEST}/${dir}/"
    done
else
    # Fallback: rsync unavailable. --dry-run requires rsync.
    if (( DRY_RUN )); then
        echo "rsync not found: --dry-run is unavailable with the cp fallback." >&2
        exit 1
    fi
    for dir in "${DIRS[@]}"; do
        mkdir -p "${DEST}/${dir}"
        cp -R "${dir}/." "${DEST}/${dir}/"
    done
    find "${DEST}" -name '.DS_Store' -delete 2>/dev/null || true
fi

if (( DRY_RUN )); then
    echo "Dry run complete — no changes written."
else
    echo "Deployed agents/, extensions/, workflow/ to ${DEST}/"
fi
