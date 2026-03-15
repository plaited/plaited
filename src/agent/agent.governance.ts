import { bSync, bThread } from '../behavioral/behavioral.utils.ts'
import { AGENT_EVENTS, BUILT_IN_TOOLS } from './agent.constants.ts'
import { type ConstitutionFactory, createConstitution } from './agent.factories.ts'
import type { AgentToolCall } from './agent.schemas.ts'

// ============================================================================
// Shared predicate helpers — used by both bThread blocks and gate checks
// ============================================================================

/**
 * Extracts the bash command string from a tool call, if present.
 *
 * @internal
 */
const getCommand = (toolCall: AgentToolCall): string | undefined =>
  toolCall.name === BUILT_IN_TOOLS.bash && typeof toolCall.arguments.command === 'string'
    ? (toolCall.arguments.command as string)
    : undefined

/**
 * Extracts the target file path from a write/edit tool call.
 *
 * @internal
 */
const getTargetPath = (toolCall: AgentToolCall): string | undefined => {
  if (toolCall.name !== BUILT_IN_TOOLS.write_file && toolCall.name !== BUILT_IN_TOOLS.edit_file) {
    return undefined
  }
  const args = toolCall.arguments
  for (const key of ['path', 'file_path', 'file']) {
    if (typeof args[key] === 'string') return args[key] as string
  }
  return undefined
}

/**
 * Checks whether a tool call targets `/etc/` paths.
 *
 * @remarks
 * Inspects both bash commands and write/edit file paths.
 * Used by the `noEtcWrites` MAC factory and available for gate-level pre-checks.
 *
 * @public
 */
export const isEtcWrite = (toolCall: AgentToolCall): boolean => {
  const command = getCommand(toolCall)
  if (command?.includes('/etc/')) return true
  const path = getTargetPath(toolCall)
  return path?.startsWith('/etc/') ?? false
}

/**
 * Checks whether a tool call contains an `rm -rf` command.
 *
 * @public
 */
export const isRmRf = (toolCall: AgentToolCall): boolean => {
  const command = getCommand(toolCall)
  return command?.includes('rm -rf') ?? false
}

/**
 * Checks whether a tool call contains a `git push --force` command.
 *
 * @remarks
 * Blocks `--force` (but not `--force-with-lease` or `--force-if-includes`)
 * and the short `-f` flag. Defense-in-depth — complements sandbox restrictions.
 *
 * @public
 */
export const isForcePush = (toolCall: AgentToolCall): boolean => {
  const command = getCommand(toolCall)
  if (command == null) return false
  if (!command.includes('git') || !command.includes('push')) return false
  // --force but NOT --force-with-lease or --force-if-includes
  if (/--force(?!-)/.test(command)) return true
  // Standalone -f flag (with or without space before argument)
  return / -f(?:\s|$|[^a-z])/.test(command)
}

/** Paths protected by MAC governance */
const MAC_GOVERNANCE_PATTERNS = ['.memory/constitution/mac/', 'constitution/mac/']

/**
 * Checks whether a tool call modifies MAC governance files.
 *
 * @remarks
 * Inspects both file operation paths and bash commands for MAC governance paths.
 *
 * @public
 */
export const isGovernanceModification = (toolCall: AgentToolCall): boolean => {
  const path = getTargetPath(toolCall)
  if (path) {
    return MAC_GOVERNANCE_PATTERNS.some((pattern) => path.includes(pattern))
  }
  const command = getCommand(toolCall)
  if (command) {
    return MAC_GOVERNANCE_PATTERNS.some((pattern) => command.includes(pattern))
  }
  return false
}

// ============================================================================
// Default MAC Factories
// ============================================================================

/**
 * Blocks execute events where a bash command or file operation targets `/etc/` paths.
 *
 * @public
 */
export const noEtcWrites = createConstitution(() => ({
  threads: {
    noEtcWrites: bThread(
      [
        bSync({
          block: (e) => e.type === AGENT_EVENTS.execute && e.detail?.toolCall != null && isEtcWrite(e.detail.toolCall),
        }),
      ],
      true,
    ),
  },
}))

/**
 * Blocks execute events containing `rm -rf` commands.
 *
 * @public
 */
export const noRmRf = createConstitution(() => ({
  threads: {
    noRmRf: bThread(
      [
        bSync({
          block: (e) => e.type === AGENT_EVENTS.execute && e.detail?.toolCall != null && isRmRf(e.detail.toolCall),
        }),
      ],
      true,
    ),
  },
}))

/**
 * Blocks execute events containing `git push --force` or `git push -f` commands.
 *
 * @public
 */
export const noForcePush = createConstitution(() => ({
  threads: {
    noForcePush: bThread(
      [
        bSync({
          block: (e) => e.type === AGENT_EVENTS.execute && e.detail?.toolCall != null && isForcePush(e.detail.toolCall),
        }),
      ],
      true,
    ),
  },
}))

/**
 * Blocks execute events that modify MAC governance files.
 *
 * @remarks
 * Enforces the ratchet principle — MAC factories cannot be removed or weakened.
 * See `docs/CONSTITUTION.md` for the protection model.
 *
 * @public
 */
export const protectGovernance = createConstitution(() => ({
  threads: {
    protectGovernance: bThread(
      [
        bSync({
          block: (e) =>
            e.type === AGENT_EVENTS.execute &&
            e.detail?.toolCall != null &&
            isGovernanceModification(e.detail.toolCall),
        }),
      ],
      true,
    ),
  },
}))

/**
 * All default MAC governance factories shipped with the framework.
 *
 * @remarks
 * Loaded at agent spawn. Immutable at runtime. See `docs/CONSTITUTION.md`.
 *
 * @public
 */
export const DEFAULT_MAC_FACTORIES: ConstitutionFactory[] = [noEtcWrites, noRmRf, noForcePush, protectGovernance]
