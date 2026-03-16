import type { SessionMeta } from '../tools/hypergraph.utils.ts'
import type { AgentPlan, ToolDefinition } from './agent.schemas.ts'
import type { ChatMessage, SensorDeltaDetail } from './agent.types.ts'

export type { SessionMeta } from '../tools/hypergraph.utils.ts'

// ============================================================================
// Context Assembly — pure functions for building model prompt from sources
// ============================================================================

/**
 * A segment of context produced by a contributor.
 *
 * @remarks
 * Each segment carries a role (for ChatMessage construction), the text content,
 * and a token estimate. The assembler uses `tokenEstimate` for budget enforcement
 * without requiring a tokenizer dependency.
 *
 * @public
 */
export type ContextSegment = {
  role: 'system' | 'user' | 'assistant'
  content: string
  tokenEstimate: number
}

/**
 * State passed to each contributor for context generation.
 *
 * @remarks
 * Assembled from the current session state. Contributors inspect
 * what they need and ignore the rest (additive composition).
 *
 * @public
 */
export type ContextState = {
  history: ChatMessage[]
  plan?: AgentPlan
  activeTools: ToolDefinition[]
  constitution: string[]
  priorRejections: string[]
}

/**
 * A contributor that produces a context segment from session state.
 *
 * @remarks
 * Contributors are pure functions — no I/O, no side effects.
 * Each contributor has a `name` (for observability/training), a `priority`
 * (higher = trimmed last), and a `contribute` function that returns
 * a `ContextSegment` or `null` (nothing to contribute).
 *
 * @public
 */
export type ContextContributor = {
  name: string
  priority: number
  contribute: (state: ContextState) => ContextSegment | null
}

// ============================================================================
// Token estimation
// ============================================================================

/**
 * Estimates token count from a string using chars/4 approximation.
 *
 * @remarks
 * Rough but practical for English text and code. ~4 characters per token
 * is the standard approximation for GPT-family tokenizers. An exact
 * tokenizer can replace this later without changing the assembly API.
 *
 * @param text - The text to estimate tokens for
 * @returns Estimated token count (always >= 1 for non-empty text)
 *
 * @public
 */
export const estimateTokens = (text: string): number => {
  if (text.length === 0) return 0
  return Math.max(1, Math.ceil(text.length / 4))
}

// ============================================================================
// Built-in contributors
// ============================================================================

/**
 * System prompt contributor — constitution rules and role description.
 *
 * @remarks
 * Highest priority (100) — trimmed last. The system prompt is the model's
 * identity and safety constraints. Losing it degrades everything else.
 *
 * @public
 */
export const systemPromptContributor = (systemPrompt: string): ContextContributor => ({
  name: 'system_prompt',
  priority: 100,
  contribute: () => ({
    role: 'system',
    content: systemPrompt,
    tokenEstimate: estimateTokens(systemPrompt),
  }),
})

/**
 * Structured system prompt contributor — composes prompt from tools, skills, and constitution.
 *
 * @remarks
 * Highest priority (100) — trimmed last. Replaces `systemPromptContributor` when
 * the caller needs a composed prompt with tool descriptions, skill summaries,
 * constitution rules, and an optional search hint for the D→A migration path.
 *
 * @public
 */
export const createSystemPromptContributor = ({
  basePrompt,
  tools,
  skills,
  constitutionRules,
  searchHint = false,
}: {
  basePrompt: string
  tools: ToolDefinition[]
  skills?: Array<{ name: string; description: string }>
  constitutionRules?: string[]
  searchHint?: boolean
}): ContextContributor => ({
  name: 'system_prompt',
  priority: 100,
  contribute: () => {
    const sections = [basePrompt]

    if (tools.length > 0) {
      sections.push(
        '## Available Tools\n' +
          tools.map((t) => `- **${t.function.name}**: ${t.function.description ?? ''}`).join('\n'),
      )
    }

    if (skills && skills.length > 0) {
      sections.push(`## Active Skills\n${skills.map((s) => `- **${s.name}**: ${s.description}`).join('\n')}`)
    }

    if (constitutionRules && constitutionRules.length > 0) {
      sections.push(`## Constraints\n${constitutionRules.map((r) => `- ${r}`).join('\n')}`)
    }

    if (searchHint) {
      sections.push(
        'If you need to recall earlier decisions or context from this session, use the search tool to query the hypergraph memory.',
      )
    }

    const content = sections.join('\n\n')
    return { role: 'system', content, tokenEstimate: estimateTokens(content) }
  },
})

// ============================================================================
// Session Summary Contributor — warm layer (tiered context Variant D)
// ============================================================================

/**
 * Return type of {@link createSessionSummaryContributor}, exposing the meta updater.
 *
 * @public
 */
export type SessionSummaryContributor = ContextContributor & {
  updateMeta: (newMeta: SessionMeta) => void
}

/**
 * Format session metadata into a concise system prompt segment.
 *
 * @internal
 */
const formatSessionSummary = (meta: SessionMeta): string => {
  const lines = [`Session context (${meta.decisionCount} decisions):`]
  if (meta.threadTypes.length > 0) lines.push(`Threads active: ${meta.threadTypes.join(', ')}`)
  if (meta.outcomeEvents.length > 0) lines.push(`Events observed: ${meta.outcomeEvents.join(', ')}`)
  if (meta.toolsUsed.length > 0) lines.push(`Tools used: ${meta.toolsUsed.join(', ')}`)
  if (meta.commits && meta.commits.length > 0) lines.push(`Commits: ${meta.commits.length}`)
  return lines.join('\n')
}

/**
 * Creates a session summary contributor (warm layer) from persisted meta.jsonld.
 *
 * @remarks
 * Priority 70 — trimmed after history (20) and plan (40) but before
 * rejections (80) and system prompt (100). The warm layer gives the model
 * orientation about what this session has accomplished without consuming
 * full conversation history budget.
 *
 * The contributor is synchronous per the `ContextContributor` contract.
 * Meta is cached at creation and updated via `updateMeta()` when the
 * consolidate handler writes new `meta.jsonld`.
 *
 * @param initialMeta - Pre-loaded session meta (or null if no meta exists yet)
 * @returns Contributor with an `updateMeta` method for the consolidate handler
 *
 * @public
 */
export const createSessionSummaryContributor = (initialMeta: SessionMeta | null): SessionSummaryContributor => {
  let meta = initialMeta

  return {
    name: 'session_summary',
    priority: 70,
    contribute: () => {
      if (!meta) return null
      const content = formatSessionSummary(meta)
      return { role: 'system', content, tokenEstimate: estimateTokens(content) }
    },
    updateMeta: (newMeta: SessionMeta) => {
      meta = newMeta
    },
  }
}

/**
 * Rejection contributor — prior gate/eval rejections.
 *
 * @remarks
 * High priority (80) — the model needs to see why previous attempts
 * were rejected to avoid repeating them. Small in size but high in value.
 *
 * @public
 */
export const rejectionContributor: ContextContributor = {
  name: 'rejections',
  priority: 80,
  contribute: (state) => {
    if (state.priorRejections.length === 0) return null
    const content = state.priorRejections.map((r, i) => `[Rejection ${i + 1}] ${r}`).join('\n')
    return {
      role: 'system',
      content: `Prior rejections (do not repeat these mistakes):\n${content}`,
      tokenEstimate: estimateTokens(content),
    }
  },
}

/**
 * Tools contributor — active tool definitions.
 *
 * @remarks
 * Medium-high priority (60). Tool definitions are needed for the model
 * to know what actions are available, but individual tools can be
 * pruned if the context budget is tight.
 *
 * @public
 */
export const toolsContributor: ContextContributor = {
  name: 'tools',
  priority: 60,
  contribute: (state) => {
    if (state.activeTools.length === 0) return null
    const content = JSON.stringify(state.activeTools)
    return {
      role: 'system',
      content: `Available tools:\n${content}`,
      tokenEstimate: estimateTokens(content),
    }
  },
}

/**
 * Plan contributor — current plan state if present.
 *
 * @remarks
 * Medium priority (40). The plan provides multi-step task context,
 * but the model can re-derive plan state from history if trimmed.
 *
 * @public
 */
export const planContributor: ContextContributor = {
  name: 'plan',
  priority: 40,
  contribute: (state) => {
    if (!state.plan) return null
    const steps = state.plan.steps
      .map(
        (s) =>
          `  - [${s.id}] ${s.intent} (tools: ${s.tools.join(', ')}${s.depends ? `, depends: ${s.depends.join(', ')}` : ''})`,
      )
      .join('\n')
    const content = `Current plan — goal: ${state.plan.goal}\n${steps}`
    return {
      role: 'system',
      content,
      tokenEstimate: estimateTokens(content),
    }
  },
}

/**
 * History contributor — conversation history.
 *
 * @remarks
 * Medium priority (20) — trimmed first among core contributors.
 * When over budget, oldest messages are dropped. The most recent
 * messages carry the most relevant context for the current turn.
 *
 * The contributor returns all history as a single segment. The assembler's
 * trimming operates at the segment level, so history is all-or-nothing
 * at the assembly layer. For finer-grained pruning (dropping oldest
 * messages), use `trimHistory` before passing to the assembler.
 *
 * @public
 */
export const historyContributor: ContextContributor = {
  name: 'history',
  priority: 20,
  contribute: (state) => {
    if (state.history.length === 0) return null
    const content = state.history.map((m) => `[${m.role}] ${m.content ?? ''}`).join('\n')
    return {
      role: 'user',
      content,
      tokenEstimate: estimateTokens(content),
    }
  },
}

// ============================================================================
// Proactive Context Contributor — framing for tick-triggered cycles
// ============================================================================

/**
 * Return type of {@link createProactiveContextContributor}, exposing mutable state setters.
 *
 * @public
 */
export type ProactiveContextContributor = ContextContributor & {
  setProactive: (isProactive: boolean) => void
  setSensorDeltas: (deltas: SensorDeltaDetail[]) => void
}

/**
 * Creates a context contributor that frames proactive (tick-triggered) cycles.
 *
 * @remarks
 * Priority 90 — below system prompt (100), above rejections (80).
 * Returns `null` during reactive (task-triggered) cycles, making it
 * zero-cost when proactive mode is not active.
 *
 * During proactive cycles, injects framing that tells the model:
 * - This is a proactive check, not a user request
 * - Sensor delta summaries (what changed since last tick)
 * - Decision guidance: act only if warranted, otherwise respond with text
 *
 * The `setProactive` and `setSensorDeltas` methods are called by the
 * tick/task handlers in agent.loop.ts to update the contributor's state
 * before context assembly.
 *
 * @returns Contributor with state setters for the agent loop
 *
 * @public
 */
export const createProactiveContextContributor = (): ProactiveContextContributor => {
  let isProactive = false
  let sensorDeltas: SensorDeltaDetail[] = []

  return {
    name: 'proactive_context',
    priority: 90,
    contribute: () => {
      if (!isProactive) return null

      const sections = ['## Proactive Check', 'This cycle was triggered by a periodic heartbeat, not a user request.']

      if (sensorDeltas.length > 0) {
        const deltaLines = sensorDeltas.map((d) => `- **${d.sensor}**: ${JSON.stringify(d.delta)}`)
        sections.push(`### Sensor Deltas\n${deltaLines.join('\n')}`)
      } else {
        sections.push('No sensor changes detected since last check.')
      }

      sections.push(
        'Based strictly on this context, is any action required? If no, respond with text only. If yes, produce tool calls.',
      )

      const content = sections.join('\n\n')
      return { role: 'system', content, tokenEstimate: estimateTokens(content) }
    },
    setProactive: (value: boolean) => {
      isProactive = value
    },
    setSensorDeltas: (deltas: SensorDeltaDetail[]) => {
      sensorDeltas = deltas
    },
  }
}

// ============================================================================
// History trimming — progressive three-stage degradation
// ============================================================================

/**
 * Truncate tool result content, preserving the fact that a tool was called.
 *
 * @remarks
 * Stage 2 of progressive trimming: tool results outside the recent window
 * become `[truncated]` stubs. The model still sees which tools ran and in
 * what order, but not the full output.
 *
 * @internal
 */
const truncateToolResults = (history: ChatMessage[], recentCount: number): ChatMessage[] => {
  const cutoff = history.length - recentCount
  return history.map((msg, i) => {
    if (i < cutoff && msg.role === 'tool') {
      return { ...msg, content: '[truncated]' }
    }
    return msg
  })
}

/**
 * Trims conversation history to fit within a token budget using progressive degradation.
 *
 * @remarks
 * Three tiers of degradation, applied cumulatively:
 *
 * 1. **Full content** — everything fits, return as-is
 * 2. **Truncated** — tool results outside the `recentWindow` are replaced with
 *    `[truncated]` (the model knows a tool was called but not the output),
 *    then oldest messages are dropped to fit
 * 3. **Fallback** — if even truncated history produces nothing, return the
 *    last `recentWindow` messages (aggressive but guaranteed context)
 *
 * The truncation step often preserves more messages than pure dropping, since
 * large tool outputs shrink to a few bytes.
 *
 * @param history - Full conversation history
 * @param budget - Maximum token budget for history
 * @param recentWindow - Number of recent messages whose tool results stay intact (default: 10)
 * @returns Trimmed history (newest messages preserved, no mutation)
 *
 * @public
 */
export const trimHistory = (history: ChatMessage[], budget: number, recentWindow = 10): ChatMessage[] => {
  if (budget <= 0) return []

  // Fast path: everything fits within budget
  if (totalTokens(history) <= budget) return history

  // Truncate old tool results (outside recent window) to save space
  const withTruncated = truncateToolResults(history, recentWindow)

  // Drop oldest messages that still don't fit
  const trimmed = dropOldest(withTruncated, budget)

  // Fallback: ensure at least the recent window is returned
  if (trimmed.length === 0 && history.length > 0) {
    return history.slice(-Math.min(recentWindow, history.length))
  }

  return trimmed
}

/**
 * Drop oldest messages until remaining fit within budget.
 *
 * @internal
 */
const dropOldest = (history: ChatMessage[], budget: number): ChatMessage[] => {
  let total = 0
  const result: ChatMessage[] = []
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i]!
    const tokens = estimateTokens(msg.content ?? '')
    if (total + tokens > budget) break
    total += tokens
    result.unshift(msg)
  }
  return result
}

/**
 * Sum token estimates for a message array.
 *
 * @internal
 */
const totalTokens = (messages: ChatMessage[]): number => {
  let total = 0
  for (const msg of messages) {
    total += estimateTokens(msg.content ?? '')
  }
  return total
}

// ============================================================================
// Context Assembler
// ============================================================================

/**
 * Assembled model context ready for `Model.reason()`.
 *
 * @remarks
 * Contains the ordered `ChatMessage[]` and metadata about what was
 * included/excluded — useful for observability and training signal.
 *
 * @public
 */
export type AssembledContext = {
  messages: ChatMessage[]
  included: string[]
  excluded: string[]
  totalTokenEstimate: number
}

// ============================================================================
// Internal assembly implementation
// ============================================================================

const assembleWithState = (
  contributors: ContextContributor[],
  budget: number,
  ctxState?: ContextState,
): AssembledContext => {
  const defaultState: ContextState = {
    history: [],
    activeTools: [],
    constitution: [],
    priorRejections: [],
  }
  const state = ctxState ?? defaultState

  // Phase 1: Collect non-null segments with their contributor index (for ordering)
  const collected: { index: number; name: string; priority: number; segment: ContextSegment }[] = []
  for (let i = 0; i < contributors.length; i++) {
    const c = contributors[i]!
    const segment = c.contribute(state)
    if (segment) {
      collected.push({ index: i, name: c.name, priority: c.priority, segment })
    }
  }

  // Phase 2: Sort by priority descending (highest priority = kept first)
  const byPriority = [...collected].sort((a, b) => b.priority - a.priority)

  // Phase 3: Greedily include segments in priority order within budget
  let remaining = budget
  const includedSet = new Set<number>()
  const included: string[] = []
  const excluded: string[] = []

  for (const entry of byPriority) {
    if (entry.segment.tokenEstimate <= remaining) {
      remaining -= entry.segment.tokenEstimate
      includedSet.add(entry.index)
      included.push(entry.name)
    } else {
      excluded.push(entry.name)
    }
  }

  // Phase 4: Build messages in original contributor order (not priority order)
  const messages: ChatMessage[] = []
  let totalTokenEstimate = 0

  for (const entry of collected) {
    if (includedSet.has(entry.index)) {
      messages.push({
        role: entry.segment.role,
        content: entry.segment.content,
      })
      totalTokenEstimate += entry.segment.tokenEstimate
    }
  }

  return { messages, included, excluded, totalTokenEstimate }
}

// ============================================================================
// Context Assembler
// ============================================================================

/**
 * Assembles context from contributors within a token budget.
 *
 * @remarks
 * 1. Calls each contributor to get segments
 * 2. Sorts by priority (highest first — these are kept)
 * 3. Accumulates segments until budget is exceeded
 * 4. Drops lowest-priority segments that don't fit
 * 5. Returns messages in contributor-defined order (not priority order)
 *
 * The two-pass approach (sort by priority for selection, then restore
 * original order for message sequence) ensures the model sees a
 * coherent prompt: system → tools → plan → history, not shuffled
 * by priority ranking.
 *
 * @param contributors - Context contributors to call
 * @param budget - Maximum token budget
 * @returns Assembled context with inclusion metadata
 *
 * @public
 */
export const assembleContext = (contributors: ContextContributor[], budget: number): AssembledContext =>
  assembleWithState(contributors, budget)

/**
 * Creates a context assembler bound to a specific set of contributors.
 *
 * @remarks
 * The factory captures contributors and provides the `ContextState`
 * on each assembly call. This is the primary API for the agent loop.
 *
 * @param contributors - Context contributors to use
 * @returns A function that assembles context from state within a budget
 *
 * @public
 */
export const createContextAssembler =
  (contributors: ContextContributor[]) =>
  (ctxState: ContextState, budget: number): AssembledContext => {
    return assembleWithState(contributors, budget, ctxState)
  }
