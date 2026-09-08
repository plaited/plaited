#!/usr/bin/env bash
# Deterministic git-repo fixture builder for the build-git-context-skill task.
#
# Usage: build-git-fixture.sh <target-dir>
#
# Builds a small repo with fully pinned commits (fixed author/committer
# identity and fixed author/committer dates), so every fixture rebuild is
# byte-for-byte reproducible:
#
#   dev                     <- baseline commit (README.md, src/baseline.ts)
#   feature/agent-work      <- one commit adding src/tracked.ts (HEAD)
#
# The verifier recomputes expected values from git at grading time; the pinned
# dates just keep SHAs stable across trials for easier debugging.
set -euo pipefail

TARGET="${1:?Usage: build-git-fixture.sh <target-dir>}"

if [ -e "$TARGET" ]; then
  rm -rf "$TARGET"
fi
mkdir -p "$TARGET"
cd "$TARGET"

export GIT_AUTHOR_NAME="Fixture Builder"
export GIT_AUTHOR_EMAIL="fixture@example.com"
export GIT_COMMITTER_NAME="Fixture Builder"
export GIT_COMMITTER_EMAIL="fixture@example.com"
export GIT_AUTHOR_DATE="2026-01-15T10:00:00+00:00"
export GIT_COMMITTER_DATE="2026-01-15T10:00:00+00:00"

git init -b dev >/dev/null
git config user.name "Fixture Builder"
git config user.email "fixture@example.com"

# Baseline commit on dev
mkdir -p src
printf '# fixture repo\n' > README.md
printf 'export const baseline = 0\n' > src/baseline.ts
git add .
git commit -m "chore: baseline" >/dev/null

# Feature branch with one commit
git checkout -b feature/agent-work >/dev/null
printf "export const tracked = 'initial'\n" > src/tracked.ts
git add src/tracked.ts
GIT_AUTHOR_DATE="2026-01-15T11:00:00+00:00" \
GIT_COMMITTER_DATE="2026-01-15T11:00:00+00:00" \
git commit -m "feat: add tracked module" >/dev/null

echo "$TARGET"
