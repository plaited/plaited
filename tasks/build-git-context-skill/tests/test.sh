#!/usr/bin/env bash
# Verifier for the build-git-context-skill task.
#
# Layer 1 — discovery + skill validity (gates the reward).
# Layer 2 — CLI behavioral correctness: rebuilds a deterministic git fixture,
#           applies mutations, recomputes expected values from git at grading
#           time, and compares the installed skill's CLI output against them.
#           No stored golden blobs: every expectation comes from git/jq here.
#
# Writes /logs/verifier/reward.json:
# { reward, skill_valid, cli_accuracy, checks_passed, checks_total,
#   installed_project_level, installed_user_level }
set -uo pipefail

TASK_NAME="git-context"
WORKDIR="${VERIFIER_WORKDIR:-/app}"
LOG_DIR="/logs/verifier"
REWARD_FILE="$LOG_DIR/reward.json"
TMP="$(mktemp -d /tmp/gitctx-verify.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$LOG_DIR"

CHECKS_PASSED=0
CHECKS_TOTAL=12
CLI_ACCURACY="0.0000"
SKILL_VALID=0
INSTALLED_PROJECT=0
INSTALLED_USER=0

log() { echo "[git-context-verifier] $*"; }

pass() { CHECKS_PASSED=$((CHECKS_PASSED + 1)); log "PASS: $1"; }
fail() { log "FAIL: $1"; }

write_reward() {
  local reward
  reward="$(awk -v s="$SKILL_VALID" -v a="$CLI_ACCURACY" 'BEGIN { printf "%.4f", s * a }')"
  cat > "$REWARD_FILE" <<EOF
{
  "reward": $reward,
  "skill_valid": $SKILL_VALID,
  "cli_accuracy": $CLI_ACCURACY,
  "checks_passed": $CHECKS_PASSED,
  "checks_total": $CHECKS_TOTAL,
  "installed_project_level": $INSTALLED_PROJECT,
  "installed_user_level": $INSTALLED_USER
}
EOF
  log "reward.json: $REWARD_FILE"
  cat "$REWARD_FILE"
}

# ============================================================================
# Layer 1 — discovery + skill validity
# ============================================================================

PROJECT_SKILL_DIR="$WORKDIR/.agents/skills/$TASK_NAME"
USER_SKILL_DIR="${HOME:-/root}/.agents/skills/$TASK_NAME"

if [ -f "$PROJECT_SKILL_DIR/SKILL.md" ]; then
  SKILL_DIR="$PROJECT_SKILL_DIR"
  INSTALLED_PROJECT=1
  log "Skill resolved at project level: $SKILL_DIR"
elif [ -f "$USER_SKILL_DIR/SKILL.md" ]; then
  SKILL_DIR="$USER_SKILL_DIR"
  INSTALLED_USER=1
  log "Skill resolved at user level: $SKILL_DIR"
else
  log "Skill not installed at a conventional location."
  log "  looked in: $PROJECT_SKILL_DIR/SKILL.md"
  log "  looked in: $USER_SKILL_DIR/SKILL.md"
  write_reward
  exit 0
fi

FM="$(sed -n '/^---$/,/^---$/p' "$SKILL_DIR/SKILL.md" | sed '1d;$d')"
FM_NAME="$(printf '%s\n' "$FM" | sed -n 's/^name:[[:space:]]*//p' | head -1 | tr -d '\"'"'"'')"
FM_DESCRIPTION="$(printf '%s\n' "$FM" | sed -n 's/^description:[[:space:]]*//p' | head -1 | tr -d '\"'"'"'')"
BODY="$(awk 'BEGIN{n=0} /^---$/{n++; next} n>=2{print}' "$SKILL_DIR/SKILL.md")"

LAYER1_OK=1

assert_layer1() {
  if [ "$2" -eq 1 ]; then
    log "Layer1 PASS: $1"
  else
    log "Layer1 FAIL: $1"
    LAYER1_OK=0
  fi
}

[ -n "$FM_NAME" ] && assert_layer1 "frontmatter has a name field" 1 || assert_layer1 "frontmatter has a name field" 0
[ "$FM_NAME" = "$TASK_NAME" ] && assert_layer1 "name matches skill directory ($TASK_NAME)" 1 || assert_layer1 "name matches skill directory (got '$FM_NAME')" 0
if printf '%s' "$FM_NAME" | grep -Eq '^[a-z0-9]+(-[a-z0-9]+)*$' && [ "${#FM_NAME}" -le 64 ]; then
  assert_layer1 "name uses lowercase/digits/hyphens and is <=64 chars" 1
else
  assert_layer1 "name uses lowercase/digits/hyphens and is <=64 chars (got '$FM_NAME')" 0
fi
[ -n "$FM_DESCRIPTION" ] && assert_layer1 "description is non-empty" 1 || assert_layer1 "description is non-empty" 0
[ "$(printf '%s' "$BODY" | tr -d '[:space:]' | wc -c)" -gt 0 ] && assert_layer1 "body is non-empty" 1 || assert_layer1 "body is non-empty" 0

# Locate the CLI script: scripts/git-context or scripts/git-context.<ext>
CLI=""
for candidate in git-context git-context.ts git-context.mts git-context.js git-context.mjs git-context.sh; do
  if [ -f "$SKILL_DIR/scripts/$candidate" ]; then
    CLI="$SKILL_DIR/scripts/$candidate"
    break
  fi
done

if [ -z "$CLI" ]; then
  assert_layer1 "CLI script present under scripts/" 0
else
  assert_layer1 "CLI script present under scripts/" 1
  if [ -x "$CLI" ]; then
    assert_layer1 "CLI script is executable" 1
  else
    assert_layer1 "CLI script is executable" 0
  fi
fi

if [ "$LAYER1_OK" -ne 1 ]; then
  log "Layer 1 failed — skill_valid=0 zeroes the run."
  write_reward
  exit 0
fi

SKILL_VALID=1

# How to invoke the CLI: honor the shebang, fall back per extension.
if head -c 2 "$CLI" | grep -q '#!'; then
  cli_invoke() { timeout 60 "$CLI" "$@"; }
elif [[ "$CLI" == *.sh ]]; then
  cli_invoke() { timeout 60 bash "$CLI" "$@"; }
else
  cli_invoke() { timeout 60 bun "$CLI" "$@"; }
fi

# ============================================================================
# Layer 2 — build fixtures, recompute truth from git, run the CLI
# ============================================================================

REPO="$(/opt/fixtures/build-git-fixture.sh "$TMP/repo")"

# Mutations the verifier will assert on (truth recomputed via git below).
printf 'export const staged = true\n' > "$REPO/src/staged.ts"
git -C "$REPO" add src/staged.ts
printf "export const tracked = 'modified'\n" > "$REPO/src/tracked.ts"
printf 'scratch note\n' > "$REPO/notes.txt"

WT_DIR="$TMP/wt-linked"
git -C "$REPO" worktree add -b wt-branch "$WT_DIR" >/dev/null 2>&1

# --- truth from git ---
EXPECT_REPO_ROOT="$(git -C "$REPO" rev-parse --show-toplevel)"
EXPECT_BRANCH="$(git -C "$REPO" branch --show-current)"
EXPECT_HEAD="$(git -C "$REPO" rev-parse HEAD)"
EXPECT_STAGED="$(git -C "$REPO" diff --cached --name-only | sort | paste -sd'|' -)"
EXPECT_UNSTAGED="$(git -C "$REPO" diff --name-only | sort | paste -sd'|' -)"
EXPECT_UNTRACKED="$(git -C "$REPO" ls-files --others --exclude-standard | sort | paste -sd'|' -)"
BASE="dev"
EXPECT_BASE_HEAD="$(git -C "$REPO" rev-parse "$BASE")"
EXPECT_MERGE_BASE="$(git -C "$REPO" merge-base HEAD "$BASE")"
EXPECT_SUBJECTS="$(git -C "$REPO" log --pretty=format:%s "$EXPECT_MERGE_BASE..HEAD" | paste -sd'|' -)"
EXPECT_FIRST_SHA="$(git -C "$REPO" log --pretty=format:%H -1 "$EXPECT_MERGE_BASE..HEAD")"
EXPECT_CHANGED="$(git -C "$REPO" diff --name-status "$EXPECT_MERGE_BASE...HEAD" | awk -F'\t' '{print $1 ":" $2}' | sort | paste -sd'|' -)"
EXPECT_WT_COUNT="$(git -C "$REPO" worktree list --porcelain | grep -c '^worktree ' || true)"

# --- CLI invocations ---
CLI_STATUS_ERR="$TMP/status.err"
CLI_STATUS="$(cli_invoke "{\"mode\":\"status\",\"cwd\":\"$REPO\"}" 2>"$CLI_STATUS_ERR")" || true
CLI_HISTORY_ERR="$TMP/history.err"
CLI_HISTORY="$(cli_invoke "{\"mode\":\"history\",\"cwd\":\"$REPO\",\"base\":\"$BASE\",\"paths\":[\"src/tracked.ts\"],\"limit\":20}" 2>"$CLI_HISTORY_ERR")" || true
CLI_WORKTREES_ERR="$TMP/worktrees.err"
CLI_WORKTREES="$(cli_invoke "{\"mode\":\"worktrees\",\"cwd\":\"$REPO\"}" 2>"$CLI_WORKTREES_ERR")" || true
CLI_CONTEXT_ERR="$TMP/context.err"
CLI_CONTEXT="$(cli_invoke "{\"mode\":\"context\",\"cwd\":\"$REPO\",\"base\":\"$BASE\"}" 2>"$CLI_CONTEXT_ERR")" || true
CLI_CONTEXT_WT_ERR="$TMP/context-wt.err"
CLI_CONTEXT_WT="$(cli_invoke "{\"mode\":\"context\",\"cwd\":\"$REPO\",\"base\":\"$BASE\",\"includeWorktrees\":true}" 2>"$CLI_CONTEXT_WT_ERR")" || true

jqget() { jq -r "$1" 2>/dev/null <<<"$2"; }

# Keep verifier outputs for debugging.
mkdir -p "$LOG_DIR/outputs"
for pair in status history worktrees context context_wt; do
  var="CLI_${pair^^}"
  printf '%s\n' "${!var}" > "$LOG_DIR/outputs/$pair.json" 2>/dev/null || true
done

# --- check 1: status core identity ---
A_ROOT="$(jqget '.repoRoot' "$CLI_STATUS")"
A_BRANCH="$(jqget '.branch' "$CLI_STATUS")"
A_HEAD="$(jqget '.head' "$CLI_STATUS")"
if [ "$A_ROOT" = "$EXPECT_REPO_ROOT" ] && [ "$A_BRANCH" = "$EXPECT_BRANCH" ] && [ "$A_HEAD" = "$EXPECT_HEAD" ]; then
  pass "status core identity (repoRoot/branch/head)"
else
  fail "status core identity: got root='$A_ROOT' branch='$A_BRANCH' head='$A_HEAD', want root='$EXPECT_REPO_ROOT' branch='$EXPECT_BRANCH' head='$EXPECT_HEAD'"
fi

# --- check 2: staged files ---
A_STAGED="$(jqget '.dirty.stagedFiles | sort | join("|")' "$CLI_STATUS")"
if [ "$A_STAGED" = "$EXPECT_STAGED" ]; then
  pass "status staged-file detection"
else
  fail "status staged files: got '$A_STAGED', want '$EXPECT_STAGED'"
fi

# --- check 3: unstaged files ---
A_UNSTAGED="$(jqget '.dirty.unstagedFiles | sort | join("|")' "$CLI_STATUS")"
if [ "$A_UNSTAGED" = "$EXPECT_UNSTAGED" ]; then
  pass "status unstaged-file detection"
else
  fail "status unstaged files: got '$A_UNSTAGED', want '$EXPECT_UNSTAGED'"
fi

# --- check 4: untracked files ---
A_UNTRACKED="$(jqget '.dirty.untrackedFiles | sort | join("|")' "$CLI_STATUS")"
if [ "$A_UNTRACKED" = "$EXPECT_UNTRACKED" ]; then
  pass "status untracked-file detection"
else
  fail "status untracked files: got '$A_UNTRACKED', want '$EXPECT_UNTRACKED'"
fi

# --- check 5: history base resolution ---
A_BASE_HEAD="$(jqget '.baseHead' "$CLI_HISTORY")"
A_MERGE_BASE="$(jqget '.mergeBase' "$CLI_HISTORY")"
if [ "$A_BASE_HEAD" = "$EXPECT_BASE_HEAD" ] && [ "$A_MERGE_BASE" = "$EXPECT_MERGE_BASE" ]; then
  pass "history resolves baseHead and mergeBase"
else
  fail "history base resolution: got baseHead='$A_BASE_HEAD' mergeBase='$A_MERGE_BASE', want '$EXPECT_BASE_HEAD'/'$EXPECT_MERGE_BASE'"
fi

# --- check 6: commits since base ---
A_SUBJECTS="$(jqget '[.commitsSinceBase[].subject] | join("|")' "$CLI_HISTORY")"
A_COUNT="$(jqget '.commitsSinceBase | length' "$CLI_HISTORY")"
EXPECT_COUNT="$(git -C "$REPO" rev-list --count "$EXPECT_MERGE_BASE..HEAD")"
A_FIRST_SHA="$(jqget '.commitsSinceBase[0].fullSha' "$CLI_HISTORY")"
A_ISO_OK="$(jqget '.commitsSinceBase[0].committedAt | test("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}")' "$CLI_HISTORY")"
if [ "$A_SUBJECTS" = "$EXPECT_SUBJECTS" ] && [ "$A_COUNT" = "$EXPECT_COUNT" ] \
  && [ "$A_FIRST_SHA" = "$EXPECT_FIRST_SHA" ] && [ "$A_ISO_OK" = "true" ]; then
  pass "history commitsSinceBase matches git log"
else
  fail "history commits: got subjects='$A_SUBJECTS' count=$A_COUNT firstSha='$A_FIRST_SHA' isoOk=$A_ISO_OK, want subjects='$EXPECT_SUBJECTS' count=$EXPECT_COUNT firstSha='$EXPECT_FIRST_SHA' isoOk=true"
fi

# --- check 7: changed files since base ---
A_CHANGED="$(jqget '[.changedFilesSinceBase[] | (.status + ":" + .path)] | sort | join("|")' "$CLI_HISTORY")"
if [ "$A_CHANGED" = "$EXPECT_CHANGED" ]; then
  pass "history changedFilesSinceBase matches git diff --name-status"
else
  fail "history changed files: got '$A_CHANGED', want '$EXPECT_CHANGED'"
fi

# --- check 8: pathHistory ---
A_PH_PATH="$(jqget '.pathHistory[0].path' "$CLI_HISTORY")"
A_PH_LEN="$(jqget '.pathHistory | length' "$CLI_HISTORY")"
A_PH_COMMITS="$(jqget '.pathHistory[0].commits | length' "$CLI_HISTORY")"
A_PH_SUBJECT="$(jqget '.pathHistory[0].commits[0].subject' "$CLI_HISTORY")"
if [ "$A_PH_PATH" = "src/tracked.ts" ] && [ "$A_PH_LEN" = "1" ] \
  && [ "${A_PH_COMMITS:-0}" -ge 1 ] && [ "$A_PH_SUBJECT" = "feat: add tracked module" ]; then
  pass "history pathHistory returns per-path commits"
else
  fail "history pathHistory: got path='$A_PH_PATH' len=$A_PH_LEN commits=$A_PH_COMMITS subject='$A_PH_SUBJECT'"
fi

# --- check 9: worktrees ---
A_WT_CURRENT="$(jqget '.currentWorktree' "$CLI_WORKTREES")"
A_WT_LEN="$(jqget '.worktrees | length' "$CLI_WORKTREES")"
A_WT_ISCURRENT_COUNT="$(jqget '[.worktrees[] | select(.isCurrent == true)] | length' "$CLI_WORKTREES")"
A_WT_ALL_EXIST="$(jqget '[.worktrees[] | select(.exists != true)] | length' "$CLI_WORKTREES")"
A_WT_LINKED="$(jqget "[.worktrees[] | select(.path == \"$WT_DIR\")] | length" "$CLI_WORKTREES")"
if [ "$A_WT_CURRENT" = "." ] && [ "$A_WT_LEN" = "$EXPECT_WT_COUNT" ] \
  && [ "$A_WT_ISCURRENT_COUNT" = "1" ] && [ "$A_WT_ALL_EXIST" = "0" ] && [ "$A_WT_LINKED" = "1" ]; then
  pass "worktrees listing (count/isCurrent/exists/linked path)"
else
  fail "worktrees: got current='$A_WT_CURRENT' len=$A_WT_LEN isCurrent=$A_WT_ISCURRENT_COUNT missingExist=$A_WT_ALL_EXIST linkedFound=$A_WT_LINKED, want current='.' len=$EXPECT_WT_COUNT isCurrent=1 missingExist=0 linkedFound=1"
fi

# --- check 10: context without includeWorktrees excludes worktrees ---
A_CTX_WT_LEN="$(jqget '.worktrees | length' "$CLI_CONTEXT")"
A_CTX_WT_COUNT="$(jqget '.summary.worktreeCount' "$CLI_CONTEXT")"
A_CTX_MODE="$(jqget '.mode' "$CLI_CONTEXT")"
if [ "$A_CTX_MODE" = "context" ] && [ "$A_CTX_WT_LEN" = "0" ] && [ "$A_CTX_WT_COUNT" = "0" ]; then
  pass "context omits worktrees unless includeWorktrees"
else
  fail "context default: got mode='$A_CTX_MODE' worktrees=$A_CTX_WT_LEN worktreeCount=$A_CTX_WT_COUNT, want worktrees=0 worktreeCount=0 despite $EXPECT_WT_COUNT existing worktrees"
fi

# --- check 11: context with includeWorktrees includes them ---
A_CTXW_LEN="$(jqget '.worktrees | length' "$CLI_CONTEXT_WT")"
A_CTXW_COUNT="$(jqget '.summary.worktreeCount' "$CLI_CONTEXT_WT")"
A_CTXW_LINKED="$(jqget "[.worktrees[] | select(.path == \"$WT_DIR\")] | length" "$CLI_CONTEXT_WT")"
if [ "$A_CTXW_LEN" = "$EXPECT_WT_COUNT" ] && [ "$A_CTXW_COUNT" = "$EXPECT_WT_COUNT" ] && [ "$A_CTXW_LINKED" = "1" ]; then
  pass "context with includeWorktrees lists all worktrees"
else
  fail "context includeWorktrees: got worktrees=$A_CTXW_LEN worktreeCount=$A_CTXW_COUNT linkedFound=$A_CTXW_LINKED, want all = $EXPECT_WT_COUNT and linkedFound=1"
fi

# --- check 12: invalid input exits non-zero (history without base) ---
set +e
cli_invoke '{"mode":"history","cwd":"'"$REPO"'"}' >/dev/null 2>&1
INVALID_EXIT=$?
set -u
if [ "$INVALID_EXIT" -ne 0 ]; then
  pass "invalid input (history without base) exits non-zero"
else
  fail "invalid input: history without base exited 0, expected non-zero"
fi

# ============================================================================
# Reward
# ============================================================================

CLI_ACCURACY="$(awk -v p="$CHECKS_PASSED" -v t="$CHECKS_TOTAL" 'BEGIN { printf "%.4f", p / t }')"
write_reward
exit 0
