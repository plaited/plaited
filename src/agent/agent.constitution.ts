import { resolve, sep } from 'node:path'
import { RISK_CLASS } from './agent.constants.ts'
import type { AgentToolCall, GateDecision } from './agent.schemas.ts'
import type { GateCheck } from './agent.types.ts'

// ============================================================================
// Risk Classification
// ============================================================================

/** Read-only tool names that have no side effects */
const READ_ONLY_TOOLS = new Set(['read_file', 'list_files', 'save_plan'])

/** Tools that modify state but within controlled boundaries */
const SIDE_EFFECT_TOOLS = new Set(['write_file'])

/** Tools that require the highest scrutiny */
const HIGH_AMBIGUITY_TOOLS = new Set(['bash'])

/**
 * Classifies the risk level of a tool call.
 *
 * @remarks
 * - `read_only` — no side effects (read_file, list_files, save_plan)
 * - `side_effects` — modifies filesystem (write_file)
 * - `high_ambiguity` — arbitrary execution or unknown tools (bash, anything unrecognized)
 *
 * @param toolCall - The tool call to classify
 * @returns A `RISK_CLASS` value
 *
 * @public
 */
export const classifyRisk = (toolCall: AgentToolCall): string => {
  if (READ_ONLY_TOOLS.has(toolCall.name)) return RISK_CLASS.read_only
  if (SIDE_EFFECT_TOOLS.has(toolCall.name)) return RISK_CLASS.side_effects
  if (HIGH_AMBIGUITY_TOOLS.has(toolCall.name)) return RISK_CLASS.high_ambiguity
  // Unknown tools get conservative classification
  return RISK_CLASS.high_ambiguity
}

// ============================================================================
// Path Safety
// ============================================================================

/**
 * Checks whether a resolved path is safely within the workspace boundary.
 *
 * @remarks
 * Uses `node:path` `resolve()` to normalize both paths, then verifies
 * the resolved path starts with the workspace prefix. This catches
 * `..` traversal, absolute paths outside workspace, and symlink tricks
 * (to the extent that `resolve()` normalizes them).
 *
 * @param resolvedPath - The fully resolved path to check
 * @param workspace - The workspace root directory
 * @returns `true` if the path is within the workspace
 *
 * @public
 */
export const isPathSafe = (resolvedPath: string, workspace: string): boolean => {
  const normalizedPath = resolve(resolvedPath)
  const normalizedWorkspace = resolve(workspace)
  return normalizedPath === normalizedWorkspace || normalizedPath.startsWith(normalizedWorkspace + sep)
}

// ============================================================================
// Dangerous Command Detection
// ============================================================================

/** Patterns that indicate potentially dangerous bash commands */
const DANGEROUS_PATTERNS = [
  /\brm\s+-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*\s+\/|\brm\s+-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*\s+\//, // rm -rf / or rm -fr /
  /\bsudo\b/, // sudo anything
  /\bchmod\s+777\b/, // chmod 777
  /\bmkfs\b/, // mkfs (format disk)
  /\bdd\s+if=/, // dd if= (raw disk write)
  /\bcurl\b.*\|\s*(ba)?sh/, // curl | bash / curl | sh
  /\bwget\b.*\|\s*(ba)?sh/, // wget | bash
  />\s*\/dev\//, // >/dev/ (device write)
  /\bchown\b/, // chown (ownership change)
]

/**
 * Detects potentially dangerous bash commands using pattern matching.
 *
 * @remarks
 * Conservative detection of known dangerous patterns. This is not
 * an allowlist — it blocks specific high-risk patterns while
 * permitting everything else. The gate's risk classification
 * (`high_ambiguity` for all bash) provides the broader safety net.
 *
 * @param command - The bash command string to check
 * @returns `true` if the command matches a dangerous pattern
 *
 * @public
 */
export const isDangerousCommand = (command: string): boolean =>
  DANGEROUS_PATTERNS.some((pattern) => pattern.test(command))

// ============================================================================
// Safety Check (combined validation)
// ============================================================================

/**
 * Validates a tool call's arguments against safety constraints.
 *
 * @remarks
 * - File tools: validates path is within workspace via `isPathSafe()`
 * - Bash: checks command against `isDangerousCommand()`
 * - Unknown tools: returns safe (gate classification handles risk level)
 *
 * @param toolCall - The tool call to validate
 * @param options.workspace - The workspace root directory
 * @returns Object with `safe` boolean and optional `reason` string
 *
 * @public
 */
export const checkSafety = (
  toolCall: AgentToolCall,
  { workspace }: { workspace: string },
): { safe: boolean; reason?: string } => {
  const { name, arguments: args } = toolCall

  // File tools: validate path
  if (name === 'read_file' || name === 'write_file') {
    const path = args.path
    if (typeof path !== 'string') return { safe: false, reason: 'Missing or invalid path argument' }
    const resolved = resolve(workspace, path)
    if (!isPathSafe(resolved, workspace)) {
      return { safe: false, reason: `Path "${path}" resolves outside workspace` }
    }
    return { safe: true }
  }

  // list_files: pattern is scoped to workspace cwd by executor, safe by default
  if (name === 'list_files') return { safe: true }

  // Bash: check for dangerous commands
  if (name === 'bash') {
    const command = args.command
    if (typeof command !== 'string') return { safe: false, reason: 'Missing or invalid command argument' }
    if (isDangerousCommand(command)) {
      return { safe: false, reason: `Dangerous command detected: "${command}"` }
    }
    return { safe: true }
  }

  // Unknown tools: safe at this level (risk classification handles gating)
  return { safe: true }
}

// ============================================================================
// Gate Check Factory
// ============================================================================

/**
 * Creates a `GateCheck` function that evaluates proposed tool calls.
 *
 * @remarks
 * The gate runs custom checks first (short-circuit on rejection),
 * then runs `checkSafety()` for built-in validation. Returns a
 * `GateDecision` with the correct `riskClass` from `classifyRisk()`.
 *
 * Composable: consumers can inject their own checks via `customChecks`.
 *
 * @param options.workspace - The workspace root directory
 * @param options.customChecks - Optional additional checks run before built-in safety
 * @returns A `GateCheck` function
 *
 * @public
 */
export const createGateCheck = ({
  workspace,
  customChecks,
}: {
  workspace: string
  customChecks?: Array<(toolCall: AgentToolCall) => { safe: boolean; reason?: string }>
}): GateCheck => {
  return (toolCall: AgentToolCall): GateDecision => {
    const riskClass = classifyRisk(toolCall)

    // Run custom checks first (short-circuit on rejection)
    if (customChecks) {
      for (const check of customChecks) {
        const result = check(toolCall)
        if (!result.safe) {
          return { approved: false, riskClass, reason: result.reason }
        }
      }
    }

    // Run built-in safety checks
    const safety = checkSafety(toolCall, { workspace })
    if (!safety.safe) {
      return { approved: false, riskClass, reason: safety.reason }
    }

    return { approved: true, riskClass }
  }
}
