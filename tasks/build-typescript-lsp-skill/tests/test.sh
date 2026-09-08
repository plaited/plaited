#!/usr/bin/env bash
# Verifier for the build-typescript-lsp-skill task.
#
# Layer 1 — discovery + skill validity (gates the reward).
# Layer 2 — CLI behavioral correctness: recomputes expected documentSymbol
#           output and a hover position from the baked-in fixture using the
#           preinstalled TypeScript 7 native API (tests/lsp-truth.ts, copied
#           into /app at grading time so `typescript/unstable/*` resolves),
#           then compares the installed skill's CLI output against them.
#           No stored golden blobs: every expectation comes from the fixture
#           + TypeScript API at grading time.
#
# Writes /logs/verifier/reward.json:
# { reward, skill_valid, cli_accuracy, checks_passed, checks_total,
#   installed_project_level, installed_user_level }
set -uo pipefail

TASK_NAME="typescript-lsp"
WORKDIR="${VERIFIER_WORKDIR:-/app}"
LOG_DIR="/logs/verifier"
REWARD_FILE="$LOG_DIR/reward.json"
TMP="$(mktemp -d /tmp/lsp-verify.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$LOG_DIR"

CHECKS_PASSED=0
CHECKS_TOTAL=9
CLI_ACCURACY="0.0000"
SKILL_VALID=0
INSTALLED_PROJECT=0
INSTALLED_USER=0

log() { echo "[typescript-lsp-verifier] $*"; }

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

# Locate the CLI script: scripts/typescript-lsp or scripts/typescript-lsp.<ext>
CLI=""
for candidate in typescript-lsp typescript-lsp.ts typescript-lsp.mts typescript-lsp.js typescript-lsp.mjs typescript-lsp.sh; do
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
  cli_invoke() { timeout 120 "$CLI" "$@"; }
elif [[ "$CLI" == *.sh ]]; then
  cli_invoke() { timeout 120 bash "$CLI" "$@"; }
else
  cli_invoke() { timeout 120 bun "$CLI" "$@"; }
fi

# ============================================================================
# Layer 2 — recompute truth from the fixture, run the CLI
# ============================================================================

FIXTURE="/opt/fixtures/sample.ts"
ROOT_DIR="/opt/fixtures"
FIXTURE_URI="file://$FIXTURE"

# Truth: recompute expected symbols + hover position from the fixture with the
# TypeScript API. Copy the truth script into /app so `typescript/unstable/*`
# resolves through /app/node_modules, run it, then clean up.
TRUTH_ERR="$TMP/truth.err"
cp /tests/lsp-truth.ts "$WORKDIR/.verifier-lsp-truth.ts"
TRUTH_JSON="$(cd "$WORKDIR" && timeout 180 bun .verifier-lsp-truth.ts "$FIXTURE" "$ROOT_DIR" 2>"$TRUTH_ERR")"
TRUTH_EXIT=$?
rm -f "$WORKDIR/.verifier-lsp-truth.ts"

if [ "$TRUTH_EXIT" -ne 0 ] || [ -z "$TRUTH_JSON" ]; then
  log "Verifier truth computation failed (exit $TRUTH_EXIT):"
  cat "$TRUTH_ERR" >&2 || true
  write_reward
  exit 0
fi

HOVER_LINE="$(jq -r '.hover.line' <<<"$TRUTH_JSON")"
HOVER_CHAR="$(jq -r '.hover.character' <<<"$TRUTH_JSON")"

# --- CLI invocations ---
CLI_DISCOVER_ERR="$TMP/discover.err"
CLI_DISCOVER="$(cli_invoke '{"mode":"discover","rootDir":"'"$ROOT_DIR"'"}' 2>"$CLI_DISCOVER_ERR")" || true
REQUESTS_JSON="$(cat <<EOF
{"mode":"execute","rootDir":"$ROOT_DIR","file":"$FIXTURE","requests":[
  {"method":"textDocument/documentSymbol","params":{"textDocument":{"uri":"$FIXTURE_URI"}}},
  {"method":"textDocument/hover","params":{"textDocument":{"uri":"$FIXTURE_URI"},"position":{"line":$HOVER_LINE,"character":$HOVER_CHAR}}},
  {"method":"textDocument/references","params":{"textDocument":{"uri":"$FIXTURE_URI"}}}
]}
EOF
)"
CLI_EXECUTE_ERR="$TMP/execute.err"
CLI_EXECUTE="$(cli_invoke "$REQUESTS_JSON" 2>"$CLI_EXECUTE_ERR")" || true

mkdir -p "$LOG_DIR/outputs"
printf '%s\n' "$TRUTH_JSON" > "$LOG_DIR/outputs/truth.json" || true
printf '%s\n' "$CLI_DISCOVER" > "$LOG_DIR/outputs/discover.json" || true
printf '%s\n' "$CLI_EXECUTE" > "$LOG_DIR/outputs/execute.json" || true

jqget() { jq -r "$1" 2>/dev/null <<<"$2"; }

# --- check 1: discover shape ---
A_D_MODE="$(jqget '.mode' "$CLI_DISCOVER")"
A_D_CAPS="$(jqget '.capabilities | type' "$CLI_DISCOVER")"
if [ "$A_D_MODE" = "discover" ] && [ "$A_D_CAPS" = "array" ]; then
  pass "discover returns mode + capabilities array"
else
  fail "discover shape: got mode='$A_D_MODE' capabilitiesType='$A_D_CAPS'"
fi

# --- check 2: discover capabilities are exactly the documented four pairs ---
A_D_PAIRS="$(jqget '[.capabilities[] | (.method + ":" + .capability)] | sort | join("|")' "$CLI_DISCOVER")"
EXPECT_PAIRS="textDocument/completion:completionProvider|textDocument/definition:definitionProvider|textDocument/documentSymbol:documentSymbolProvider|textDocument/hover:hoverProvider"
if [ "$A_D_PAIRS" = "$EXPECT_PAIRS" ]; then
  pass "discover capabilities are exactly the four documented pairs"
else
  fail "discover capabilities: got '$A_D_PAIRS', want '$EXPECT_PAIRS'"
fi

# --- check 3: execute envelope ---
A_E_MODE="$(jqget '.mode' "$CLI_EXECUTE")"
A_E_FILE="$(jqget '.file' "$CLI_EXECUTE")"
A_E_LEN="$(jqget '.results | length' "$CLI_EXECUTE")"
A_E_METHODS="$(jqget '[.results[].method] | join("|")' "$CLI_EXECUTE")"
if [ "$A_E_MODE" = "execute" ] && [[ "$A_E_FILE" == *sample.ts ]] && [ "$A_E_LEN" = "3" ] \
  && [ "$A_E_METHODS" = "textDocument/documentSymbol|textDocument/hover|textDocument/references" ]; then
  pass "execute envelope (mode/file/results aligned with requests)"
else
  fail "execute envelope: got mode='$A_E_MODE' file='$A_E_FILE' len=$A_E_LEN methods='$A_E_METHODS'"
fi

# --- check 4: documentSymbol names in source order ---
A_NAMES="$(jqget '[.results[0].result[].name] | join("|")' "$CLI_EXECUTE")"
E_NAMES="$(jq -r '[.symbols[].name] | join("|")' <<<"$TRUTH_JSON")"
if [ "$A_NAMES" = "$E_NAMES" ] && [ -n "$E_NAMES" ]; then
  pass "documentSymbol names match recomputed symbols in source order"
else
  fail "documentSymbol names: got '$A_NAMES', want '$E_NAMES'"
fi

# --- check 5: documentSymbol kinds ---
A_KINDS="$(jqget '[.results[0].result[].kind] | join("|")' "$CLI_EXECUTE")"
E_KINDS="$(jq -r '[.symbols[].kind] | join("|")' <<<"$TRUTH_JSON")"
if [ "$A_KINDS" = "$E_KINDS" ] && [ -n "$E_KINDS" ]; then
  pass "documentSymbol kinds match recomputed kinds"
else
  fail "documentSymbol kinds: got '$A_KINDS', want '$E_KINDS'"
fi

# --- check 6: documentSymbol ranges (offsets) ---
A_RANGES="$(jqget '[.results[0].result[].range | (.[0] | tostring) + ":" + (.[1] | tostring)] | join("|")' "$CLI_EXECUTE")"
E_RANGES="$(jq -r '[.symbols[].range | (.[0] | tostring) + ":" + (.[1] | tostring)] | join("|")' <<<"$TRUTH_JSON")"
if [ "$A_RANGES" = "$E_RANGES" ] && [ -n "$E_RANGES" ]; then
  pass "documentSymbol ranges match recomputed offsets"
else
  fail "documentSymbol ranges: got '$A_RANGES', want '$E_RANGES'"
fi

# --- check 7: hover at formatValue ---
A_HOVER_NAME="$(jqget '.results[1].result.name' "$CLI_EXECUTE")"
A_HOVER_TYPE="$(jqget '.results[1].result.type' "$CLI_EXECUTE")"
A_HOVER_IS_STRING="$(jqget '.results[1].result.type | type == "string"' "$CLI_EXECUTE")"
if [ "$A_HOVER_NAME" = "formatValue" ] && [ "$A_HOVER_IS_STRING" = "true" ] && [ -n "$A_HOVER_TYPE" ]; then
  pass "hover returns formatValue with a non-empty type"
else
  fail "hover: got name='$A_HOVER_NAME' typeType='$A_HOVER_IS_STRING' type='$A_HOVER_TYPE' (expected name=formatValue and non-empty string type)"
fi

# --- check 8: unsupported method is an inline error, others still succeed ---
A_UNSUPPORTED="$(jqget '.results[2].error' "$CLI_EXECUTE")"
A_SYMBOLS_STILL_OK="$(jqget '.results[0].result | type' "$CLI_EXECUTE")"
if [[ "$A_UNSUPPORTED" == *"Unsupported method"* ]] && [ "$A_SYMBOLS_STILL_OK" = "array" ]; then
  pass "unsupported method yields inline error while other requests succeed"
else
  fail "unsupported method: got error='$A_UNSUPPORTED' symbolsType='$A_SYMBOLS_STILL_OK'"
fi

# --- check 9: invalid input exits non-zero ---
set +e
cli_invoke 'not-json' >/dev/null 2>&1
INVALID_EXIT=$?
set -u
if [ "$INVALID_EXIT" -ne 0 ]; then
  pass "invalid input (unparseable JSON) exits non-zero"
else
  fail "invalid input: unparseable JSON exited 0, expected non-zero"
fi

# ============================================================================
# Reward
# ============================================================================

CLI_ACCURACY="$(awk -v p="$CHECKS_PASSED" -v t="$CHECKS_TOTAL" 'BEGIN { printf "%.4f", p / t }')"
write_reward
exit 0
