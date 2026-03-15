import { bSync, bThread } from '../behavioral/behavioral.utils.ts'
import type { DefaultHandlers, RulesFunction, Trigger } from '../behavioral/behavioral.types.ts'
import { AGENT_EVENTS, BUILT_IN_TOOLS } from './agent.constants.ts'
import type { AgentToolCall } from './agent.schemas.ts'

// ============================================================================
// Governance Factory Identifier + Types
// ============================================================================

/**
 * Brand identifier for governance factory functions.
 *
 * @remarks
 * Extends the codebase's `$` brand pattern (`🦄` templates, `🪢` RulesFunction,
 * `🎛️` ControllerTemplate, `🎨` DecoratorTemplate).
 *
 * @public
 */
export const GOVERNANCE_FACTORY_IDENTIFIER = '🏛️' as const

/**
 * Return shape of a governance factory invocation.
 *
 * @public
 */
export type GovernanceFactoryResult = {
  threads?: Record<string, RulesFunction>
  handlers?: DefaultHandlers
}

/**
 * A branded factory function that produces bThreads and/or handlers
 * for governance enforcement.
 *
 * @remarks
 * MAC (Mandatory Access Control) factories are loaded at spawn and immutable.
 * DAC (Discretionary Access Control) factories are loaded with user approval.
 * Both use the same contract — the distinction is lifecycle, not shape.
 *
 * @public
 */
export type GovernanceFactory = {
  (trigger: Trigger): GovernanceFactoryResult
  $: typeof GOVERNANCE_FACTORY_IDENTIFIER
  name: string
  layer: 'mac' | 'dac'
}

// ============================================================================
// createGovernanceFactory — brands and validates
// ============================================================================

/**
 * Creates a branded governance factory function.
 *
 * @param args - Factory configuration
 * @param args.name - Human-readable factory name
 * @param args.layer - `'mac'` (immutable) or `'dac'` (user-controlled)
 * @param args.create - Factory implementation receiving a `Trigger`
 * @returns A branded {@link GovernanceFactory}
 *
 * @public
 */
export const createGovernanceFactory = ({
  name,
  layer,
  create,
}: {
  name: string
  layer: 'mac' | 'dac'
  create: (trigger: Trigger) => GovernanceFactoryResult
}): GovernanceFactory => {
  const fn = (trigger: Trigger) => create(trigger)
  // Function.name is configurable but not writable — Object.assign would throw.
  // Use defineProperties to set all brand properties directly.
  Object.defineProperties(fn, {
    $: { value: GOVERNANCE_FACTORY_IDENTIFIER, enumerable: true },
    name: { value: name, configurable: true },
    layer: { value: layer, enumerable: true },
  })
  return fn as GovernanceFactory
}

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
  if (command != null && command.includes('/etc/')) return true
  const path = getTargetPath(toolCall)
  return path != null && path.includes('/etc/')
}

/**
 * Checks whether a tool call contains an `rm -rf` command.
 *
 * @public
 */
export const isRmRf = (toolCall: AgentToolCall): boolean => {
  const command = getCommand(toolCall)
  return command != null && command.includes('rm -rf')
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
  // Standalone -f flag
  return / -f(?:\s|$)/.test(command)
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
export const noEtcWrites = createGovernanceFactory({
  name: 'noEtcWrites',
  layer: 'mac',
  create: () => ({
    threads: {
      noEtcWrites: bThread(
        [
          bSync({
            block: (e) =>
              e.type === AGENT_EVENTS.execute && e.detail?.toolCall != null && isEtcWrite(e.detail.toolCall),
          }),
        ],
        true,
      ),
    },
  }),
})

/**
 * Blocks execute events containing `rm -rf` commands.
 *
 * @public
 */
export const noRmRf = createGovernanceFactory({
  name: 'noRmRf',
  layer: 'mac',
  create: () => ({
    threads: {
      noRmRf: bThread(
        [
          bSync({
            block: (e) =>
              e.type === AGENT_EVENTS.execute && e.detail?.toolCall != null && isRmRf(e.detail.toolCall),
          }),
        ],
        true,
      ),
    },
  }),
})

/**
 * Blocks execute events containing `git push --force` or `git push -f` commands.
 *
 * @public
 */
export const noForcePush = createGovernanceFactory({
  name: 'noForcePush',
  layer: 'mac',
  create: () => ({
    threads: {
      noForcePush: bThread(
        [
          bSync({
            block: (e) =>
              e.type === AGENT_EVENTS.execute && e.detail?.toolCall != null && isForcePush(e.detail.toolCall),
          }),
        ],
        true,
      ),
    },
  }),
})

/**
 * Blocks execute events that modify MAC governance files.
 *
 * @remarks
 * Enforces the ratchet principle — MAC factories cannot be removed or weakened.
 * See `docs/CONSTITUTION.md` for the protection model.
 *
 * @public
 */
export const protectGovernance = createGovernanceFactory({
  name: 'protectGovernance',
  layer: 'mac',
  create: () => ({
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
  }),
})

/**
 * All default MAC governance factories shipped with the framework.
 *
 * @remarks
 * Loaded at agent spawn. Immutable at runtime. See `docs/CONSTITUTION.md`.
 *
 * @public
 */
export const DEFAULT_MAC_FACTORIES: GovernanceFactory[] = [noEtcWrites, noRmRf, noForcePush, protectGovernance]
