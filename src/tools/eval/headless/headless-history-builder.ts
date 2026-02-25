/**
 * History builder for iterative mode sessions.
 *
 * @remarks
 * In iterative mode, each prompt spawns a new process. The history builder
 * accumulates conversation context and formats it using the schema's
 * historyTemplate for inclusion in subsequent prompts.
 *
 * @packageDocumentation
 */

// ============================================================================
// Types
// ============================================================================

/** A single turn in conversation history */
export type HistoryTurn = {
  /** User input */
  input: string
  /** Agent output */
  output: string
}

/** History builder configuration */
export type HistoryBuilderConfig = {
  /** Template for formatting history (e.g., "User: {{input}}\nAssistant: {{output}}") */
  template?: string
}

// ============================================================================
// Default Template
// ============================================================================

const DEFAULT_TEMPLATE = 'User: {{input}}\nAssistant: {{output}}'

// ============================================================================
// History Builder Factory
// ============================================================================

/**
 * Creates a history builder for iterative mode sessions.
 *
 * @remarks
 * The history builder:
 * 1. Stores conversation turns
 * 2. Formats history using the template
 * 3. Builds complete prompts with context
 *
 * @param config - History builder configuration
 * @returns History builder with add, format, and build methods
 */
export const createHistoryBuilder = (config: HistoryBuilderConfig = {}) => {
  const template = config.template ?? DEFAULT_TEMPLATE
  const history: HistoryTurn[] = []

  /**
   * Adds a turn to history.
   *
   * @param input - User input
   * @param output - Agent output
   */
  const addTurn = (input: string, output: string): void => {
    history.push({ input, output })
  }

  /**
   * Formats the current history as a string.
   *
   * @returns Formatted history string
   */
  const formatHistory = (): string => {
    return history.map((turn) => formatTurn(turn, template)).join('\n\n')
  }

  /**
   * Builds a prompt with history context.
   *
   * @remarks
   * For the first turn, returns just the input.
   * For subsequent turns, prepends formatted history.
   *
   * @param newInput - The new user input
   * @returns Full prompt including history context
   */
  const buildPrompt = (newInput: string): string => {
    if (history.length === 0) {
      return newInput
    }

    const formattedHistory = formatHistory()
    return `${formattedHistory}\n\nUser: ${newInput}`
  }

  /**
   * Gets the number of turns in history.
   */
  const getLength = (): number => {
    return history.length
  }

  /**
   * Clears all history.
   */
  const clear = (): void => {
    history.length = 0
  }

  /**
   * Gets a copy of the history.
   */
  const getHistory = (): HistoryTurn[] => {
    return [...history]
  }

  return {
    addTurn,
    formatHistory,
    buildPrompt,
    getLength,
    clear,
    getHistory,
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Formats a single turn using the template.
 *
 * @param turn - History turn
 * @param template - Template string with {{input}} and {{output}} placeholders
 * @returns Formatted turn string
 */
const formatTurn = (turn: HistoryTurn, template: string): string => {
  return template.replace('{{input}}', turn.input).replace('{{output}}', turn.output)
}

/** History builder type */
export type HistoryBuilder = ReturnType<typeof createHistoryBuilder>
