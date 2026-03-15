import type { AgentPlan, ToolDefinition } from './agent.schemas.ts'
import type { ChatMessage } from './agent.types.ts'

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
// History trimming — fine-grained pruning for oversized history
// ============================================================================

/**
 * Trims conversation history to fit within a token budget.
 *
 * @remarks
 * Drops oldest messages first, preserving the most recent context.
 * Called before context assembly when history is large. Returns a
 * new array (no mutation).
 *
 * @param history - Full conversation history
 * @param budget - Maximum token budget for history
 * @returns Trimmed history (newest messages preserved)
 *
 * @public
 */
export const trimHistory = (history: ChatMessage[], budget: number): ChatMessage[] => {
  if (budget <= 0) return []
  let total = 0
  const result: ChatMessage[] = []
  // Walk from newest to oldest, accumulating until budget exceeded
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i]!
    const tokens = estimateTokens(msg.content ?? '')
    if (total + tokens > budget) break
    total += tokens
    result.unshift(msg)
  }
  return result
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
