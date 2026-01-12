/**
 * Context Budget Management for LLM interactions.
 *
 * @remarks
 * Manages token budget allocation for different parts of the context window.
 * Especially important for smaller models like FunctionGemma (32K tokens).
 *
 * Features:
 * - Token estimation for text, tools, and structured content
 * - Budget allocation across context sections
 * - Progressive disclosure of tools/skills based on budget
 * - Priority-based content trimming
 */

import type { ToolSchema } from './agent.types.ts'

// ============================================================================
// Types
// ============================================================================

/**
 * Context section types.
 */
export type ContextSection =
  | 'system' // System prompt, instructions
  | 'tools' // Tool schemas
  | 'skills' // Skill metadata
  | 'conversation' // User/assistant messages
  | 'cache' // Cached context
  | 'reserved' // Reserved for response generation

/**
 * Section budget allocation.
 */
export type SectionBudget = {
  /** Section identifier */
  section: ContextSection
  /** Allocated token budget */
  allocated: number
  /** Currently used tokens */
  used: number
  /** Priority (higher = less likely to trim) */
  priority: number
}

/**
 * Budget configuration.
 */
export type BudgetConfig = {
  /** Total token budget (default: 32000 for FunctionGemma) */
  totalBudget?: number
  /** Tokens reserved for response generation (default: 4000) */
  reservedForResponse?: number
  /** Default section allocations */
  sectionAllocations?: Partial<Record<ContextSection, number>>
  /** Characters per token estimate (default: 4) */
  charsPerToken?: number
}

/**
 * Budget status.
 */
export type BudgetStatus = {
  /** Total budget */
  total: number
  /** Total used */
  used: number
  /** Available tokens */
  available: number
  /** Usage percentage (0-100) */
  usagePercent: number
  /** Per-section breakdown */
  sections: SectionBudget[]
  /** Whether budget is exceeded */
  exceeded: boolean
}

/**
 * Content item with priority for trimming.
 */
export type PrioritizedContent<T = unknown> = {
  /** Content item */
  content: T
  /** Estimated token count */
  tokens: number
  /** Priority (higher = keep) */
  priority: number
  /** Section this belongs to */
  section: ContextSection
}

/**
 * Context budget manager interface.
 */
export type ContextBudget = {
  /** Estimate tokens for text */
  estimateTokens: (text: string) => number
  /** Estimate tokens for a tool schema */
  estimateToolTokens: (schema: ToolSchema) => number
  /** Allocate tokens to a section */
  allocate: (section: ContextSection, tokens: number) => void
  /** Record usage for a section */
  use: (section: ContextSection, tokens: number) => void
  /** Get current budget status */
  status: () => BudgetStatus
  /** Check if budget allows adding content */
  canFit: (tokens: number, section?: ContextSection) => boolean
  /** Filter content to fit budget */
  fitToBudget: <T>(items: Array<PrioritizedContent<T>>) => T[]
  /** Reset all usage (keep allocations) */
  reset: () => void
  /** Set section priority */
  setPriority: (section: ContextSection, priority: number) => void
}

// ============================================================================
// Token Estimation
// ============================================================================

/**
 * Default characters per token.
 *
 * @remarks
 * This is a rough estimate. Different tokenizers vary:
 * - GPT-4: ~4 chars/token
 * - Claude: ~3.5 chars/token
 * - Gemma: ~4 chars/token
 */
const DEFAULT_CHARS_PER_TOKEN = 4

/**
 * Estimates token count for text.
 *
 * @param text - Text to estimate
 * @param charsPerToken - Characters per token ratio
 * @returns Estimated token count
 *
 * @remarks
 * Simple character-based estimation. For more accuracy,
 * use the actual tokenizer for your model.
 */
export const estimateTokens = (text: string, charsPerToken = DEFAULT_CHARS_PER_TOKEN): number => {
  if (!text) return 0
  return Math.ceil(text.length / charsPerToken)
}

/**
 * Estimates token count for a tool schema.
 *
 * @param schema - Tool schema
 * @param charsPerToken - Characters per token ratio
 * @returns Estimated token count
 *
 * @remarks
 * Accounts for JSON structure overhead in addition to content.
 * Tool schemas include name, description, and parameter definitions.
 */
export const estimateToolTokens = (schema: ToolSchema, charsPerToken = DEFAULT_CHARS_PER_TOKEN): number => {
  // Name + description
  let chars = schema.name.length + schema.description.length

  // Parameters (JSON structure adds overhead)
  const paramsJson = JSON.stringify(schema.parameters)
  chars += paramsJson.length

  // Add overhead for JSON structure (~20%)
  chars = Math.ceil(chars * 1.2)

  return Math.ceil(chars / charsPerToken)
}

/**
 * Estimates token count for multiple tools.
 *
 * @param schemas - Array of tool schemas
 * @param charsPerToken - Characters per token ratio
 * @returns Total estimated token count
 */
export const estimateToolsTokens = (schemas: ToolSchema[], charsPerToken = DEFAULT_CHARS_PER_TOKEN): number =>
  schemas.reduce((total, schema) => total + estimateToolTokens(schema, charsPerToken), 0)

// ============================================================================
// Default Allocations
// ============================================================================

/**
 * Default section allocations for 32K context.
 *
 * @remarks
 * Optimized for FunctionGemma's 32K token limit:
 * - System: Core instructions and constraints
 * - Tools: Progressive tool discovery keeps this manageable
 * - Skills: Compact XML format (~50-100 tokens per skill)
 * - Conversation: Main budget for back-and-forth
 * - Cache: Optional cached context
 * - Reserved: For response generation
 */
const DEFAULT_ALLOCATIONS: Record<ContextSection, number> = {
  system: 4000,
  tools: 6000,
  skills: 2000,
  conversation: 12000,
  cache: 4000,
  reserved: 4000,
}

/**
 * Default section priorities (higher = less likely to trim).
 */
const DEFAULT_PRIORITIES: Record<ContextSection, number> = {
  system: 100, // Never trim system
  reserved: 90, // Keep response budget
  conversation: 70, // Recent conversation important
  tools: 50, // Tools can be filtered
  skills: 40, // Skills can be filtered
  cache: 30, // Cache can be evicted
}

// ============================================================================
// Context Budget Implementation
// ============================================================================

/**
 * Creates a context budget manager.
 *
 * @param config - Budget configuration
 * @returns Context budget manager
 *
 * @remarks
 * Default configuration is optimized for FunctionGemma (32K tokens).
 * For larger models, increase totalBudget proportionally.
 *
 * See `src/agent-next/tests/context-budget.spec.ts` for usage patterns.
 */
export const createContextBudget = (config: BudgetConfig = {}): ContextBudget => {
  const {
    totalBudget = 32000,
    reservedForResponse = 4000,
    sectionAllocations = {},
    charsPerToken = DEFAULT_CHARS_PER_TOKEN,
  } = config

  // Initialize sections
  const sections = new Map<ContextSection, SectionBudget>()

  for (const section of Object.keys(DEFAULT_ALLOCATIONS) as ContextSection[]) {
    const allocated = sectionAllocations[section] ?? DEFAULT_ALLOCATIONS[section]
    sections.set(section, {
      section,
      allocated,
      used: 0,
      priority: DEFAULT_PRIORITIES[section],
    })
  }

  // Override reserved allocation
  const reserved = sections.get('reserved')!
  reserved.allocated = reservedForResponse

  return {
    estimateTokens(text: string): number {
      return estimateTokens(text, charsPerToken)
    },

    estimateToolTokens(schema: ToolSchema): number {
      return estimateToolTokens(schema, charsPerToken)
    },

    allocate(section: ContextSection, tokens: number): void {
      const budget = sections.get(section)
      if (budget) {
        budget.allocated = tokens
      }
    },

    use(section: ContextSection, tokens: number): void {
      const budget = sections.get(section)
      if (budget) {
        budget.used += tokens
      }
    },

    status(): BudgetStatus {
      let totalUsed = 0
      const sectionBudgets: SectionBudget[] = []

      for (const budget of sections.values()) {
        totalUsed += budget.used
        sectionBudgets.push({ ...budget })
      }

      const available = totalBudget - totalUsed

      return {
        total: totalBudget,
        used: totalUsed,
        available,
        usagePercent: (totalUsed / totalBudget) * 100,
        sections: sectionBudgets.sort((a, b) => b.priority - a.priority),
        exceeded: totalUsed > totalBudget,
      }
    },

    canFit(tokens: number, section?: ContextSection): boolean {
      const status = this.status()

      if (section) {
        const sectionBudget = sections.get(section)
        if (sectionBudget) {
          return sectionBudget.used + tokens <= sectionBudget.allocated
        }
      }

      return status.available >= tokens
    },

    fitToBudget<T>(items: Array<PrioritizedContent<T>>): T[] {
      const status = this.status()
      let available = status.available

      // Sort by priority (descending)
      const sorted = [...items].sort((a, b) => b.priority - a.priority)

      const result: T[] = []

      for (const item of sorted) {
        if (item.tokens <= available) {
          result.push(item.content)
          available -= item.tokens

          // Record usage
          this.use(item.section, item.tokens)
        }
      }

      return result
    },

    reset(): void {
      for (const budget of sections.values()) {
        budget.used = 0
      }
    },

    setPriority(section: ContextSection, priority: number): void {
      const budget = sections.get(section)
      if (budget) {
        budget.priority = priority
      }
    },
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Creates prioritized content items from tool schemas.
 *
 * @param schemas - Tool schemas
 * @param basePriority - Base priority for tools
 * @param charsPerToken - Characters per token ratio
 * @returns Array of prioritized content items
 */
export const prioritizeTools = (
  schemas: ToolSchema[],
  basePriority = 50,
  charsPerToken = DEFAULT_CHARS_PER_TOKEN,
): Array<PrioritizedContent<ToolSchema>> =>
  schemas.map((schema, index) => ({
    content: schema,
    tokens: estimateToolTokens(schema, charsPerToken),
    // Earlier tools in the list get higher priority
    priority: basePriority + (schemas.length - index),
    section: 'tools' as const,
  }))

/**
 * Filters tools to fit within a token budget.
 *
 * @param schemas - All available tool schemas
 * @param budget - Maximum token budget for tools
 * @param charsPerToken - Characters per token ratio
 * @returns Filtered tool schemas that fit the budget
 *
 * @remarks
 * Prioritizes tools by their position in the input array.
 * For intent-based prioritization, pre-sort with filterToolsByIntent.
 */
export const filterToolsByBudget = (
  schemas: ToolSchema[],
  budget: number,
  charsPerToken = DEFAULT_CHARS_PER_TOKEN,
): ToolSchema[] => {
  let remaining = budget
  const result: ToolSchema[] = []

  for (const schema of schemas) {
    const tokens = estimateToolTokens(schema, charsPerToken)
    if (tokens <= remaining) {
      result.push(schema)
      remaining -= tokens
    }
  }

  return result
}

/**
 * Estimates conversation token usage.
 *
 * @param messages - Array of message objects with content
 * @param charsPerToken - Characters per token ratio
 * @returns Total estimated tokens
 */
export const estimateConversationTokens = (
  messages: Array<{ role: string; content: string }>,
  charsPerToken = DEFAULT_CHARS_PER_TOKEN,
): number => {
  let total = 0

  for (const msg of messages) {
    // Role marker overhead (~4 tokens per message)
    total += 4
    total += estimateTokens(msg.content, charsPerToken)
  }

  return total
}

/**
 * Trims conversation to fit budget (removes oldest messages first).
 *
 * @param messages - Array of messages
 * @param budget - Maximum token budget
 * @param charsPerToken - Characters per token ratio
 * @returns Trimmed messages array
 *
 * @remarks
 * Keeps the most recent messages. System messages (role='system')
 * are always preserved.
 */
export const trimConversation = (
  messages: Array<{ role: string; content: string }>,
  budget: number,
  charsPerToken = DEFAULT_CHARS_PER_TOKEN,
): Array<{ role: string; content: string }> => {
  // Separate system messages (always keep)
  const systemMessages = messages.filter((m) => m.role === 'system')
  const otherMessages = messages.filter((m) => m.role !== 'system')

  // Calculate system message tokens
  const systemTokens = estimateConversationTokens(systemMessages, charsPerToken)
  let remaining = budget - systemTokens

  if (remaining <= 0) {
    return systemMessages
  }

  // Keep most recent messages that fit
  const kept: Array<{ role: string; content: string }> = []

  for (let i = otherMessages.length - 1; i >= 0; i--) {
    const msg = otherMessages[i]!
    const tokens = estimateTokens(msg.content, charsPerToken) + 4

    if (tokens <= remaining) {
      kept.unshift(msg)
      remaining -= tokens
    } else {
      break
    }
  }

  return [...systemMessages, ...kept]
}
