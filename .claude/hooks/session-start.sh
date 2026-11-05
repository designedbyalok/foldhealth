#!/bin/bash
set -euo pipefail

# Only run in Claude Code on the web (remote) environments.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Resolve the project root. Prefer $CLAUDE_PROJECT_DIR when Claude Code sets
# it; otherwise anchor to this script's own location (…/.claude/hooks/),
# which is always inside the repo regardless of the cwd we were invoked
# from. The previous `git rev-parse --show-toplevel` fallback failed
# silently inside $(…) when the env-level setup script ran us from
# /home/user/: `cd ""` left cwd unchanged and `bun install` then crashed
# with "could not find a package.json".
if [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then
  PROJECT_DIR="$CLAUDE_PROJECT_DIR"
else
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
fi
cd "$PROJECT_DIR"

# Ensure Bun (the project's package manager) is available and on PATH.
export PATH="$HOME/.bun/bin:$PATH"
if ! command -v bun >/dev/null 2>&1; then
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

# Persist Bun on PATH for the rest of the session. CLAUDE_ENV_FILE is only
# defined for SessionStart hook runs: skip the write when running as the
# environment-level setup script (where it's empty/unset).
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export PATH=\"\$HOME/.bun/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi

bun install --frozen-lockfile
