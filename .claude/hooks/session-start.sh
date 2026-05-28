#!/bin/bash
set -euo pipefail

# Only run in Claude Code on the web (remote) environments.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"

# Ensure Bun (the project's package manager) is available and on PATH.
export PATH="$HOME/.bun/bin:$PATH"
if ! command -v bun >/dev/null 2>&1; then
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

# Persist Bun on PATH for the rest of the session.
echo "export PATH=\"\$HOME/.bun/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"

bun install --frozen-lockfile
