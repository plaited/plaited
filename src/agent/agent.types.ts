/**
 * Type definitions for agent-next architecture.
 *
 * @remarks
 * Protocol-agnostic types for world agents and adapters.
 * Communication happens via signals, not direct function calls.
 *
 * Implements tiered symbolic analysis:
 * - Tier 1: Static analysis (free, fast)
 * - Tier 2: Model-as-judge (selective)
 * - Tier 3: Browser execution (ground truth)
 */

import type { RulesFunction, Signal } from '../main.ts'
import type { ContextBudget } from './context-budget.ts'

// ============================================================================
// Agent Events (World Agent ↔ Adapter)
// ============================================================================

/**
 * Events emitted by the world agent (outbound).
 */
export type AgentOutEvent =
  | { kind: 'thought'; content: string }
  | { kind: 'toolCall'; calls: FunctionCall[] }
  | { kind: 'toolResult'; name: string; result: ToolResult }
  | { kind: 'response'; content: string }
  | { kind: 'error'; error: Error }
  | { kind: 'staticAnalysis'; result: StaticAnalysisResult }
  | { kind: 'judgeResult'; result: JudgeResult }

/**
 * Events received by the world agent (inbound via public trigger).
 */
export type AgentInEvent =
  | { kind: 'generate'; intent: string; context?: unknown }
  | { kind: 'cancel' }
  | { kind: 'feedback'; result: StoryResult }
  | { kind: 'executeCode'; code: string; sandbox?: SandboxConfig }
  | { kind: 'chainTools'; calls: FunctionCall[]; sequential?: boolean }
  | { kind: 'resolveTool'; name: string; source?: ToolSource }

// ============================================================================
// Tool Types
// ============================================================================

/**
 * A function call from the model.
 */
export type FunctionCall = {
  name: string
  arguments: string // JSON string
}

/**
 * Result of tool execution.
 */
export type ToolResult = {
  success: boolean
  data?: unknown
  error?: string
}

/**
 * Tool schema for model context.
 */
export type ToolSchema = {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

/**
 * Tool handler function.
 */
export type ToolHandler = (args: Record<string, unknown>) => Promise<ToolResult>

/**
 * Tool registry interface.
 */
export type ToolRegistry = {
  register: (name: string, handler: ToolHandler, schema: ToolSchema) => void
  execute: (call: FunctionCall) => Promise<ToolResult>
  schemas: ToolSchema[]
}

// ============================================================================
// Embedder Types (Shared by Discovery and Caching)
// ============================================================================

/**
 * Device types supported by Transformers.js.
 */
export type DeviceType =
  | 'auto'
  | 'gpu'
  | 'cpu'
  | 'wasm'
  | 'webgpu'
  | 'cuda'
  | 'dml'
  | 'webnn'
  | 'webnn-npu'
  | 'webnn-gpu'
  | 'webnn-cpu'

/**
 * Data types for model quantization.
 */
export type DataType = 'auto' | 'fp32' | 'fp16' | 'q8' | 'int8' | 'uint8' | 'q4' | 'bnb4' | 'q4f16'

/**
 * Embedder configuration for vector search.
 *
 * @remarks
 * Models are cached locally after first download via Transformers.js.
 */
export type EmbedderConfig = {
  /** Model ID (default: 'Xenova/multilingual-e5-small') */
  model?: string
  /** Quantization level (default: 'q8') */
  dtype?: DataType
  /** Inference device (default: 'auto' - auto-detects GPU) */
  device?: DeviceType
}

// ============================================================================
// Story/Training Types
// ============================================================================

/**
 * Result from running a story test.
 */
export type StoryResult = {
  passed: boolean
  a11yPassed: boolean
  totalAssertions: number
  passedAssertions: number
  errors: string[]
}

// ============================================================================
// Context Types
// ============================================================================

/**
 * Context required by useWorldAgent.
 */
export type WorldAgentContext = {
  outbound: Signal<AgentOutEvent>
  tools: ToolRegistry
  model: InferenceModel
}

/**
 * Context required by adapters.
 */
export type AdapterContext = {
  outbound: Signal<unknown>
}

// ============================================================================
// Model Types
// ============================================================================

/**
 * Inference model interface (e.g., HuggingFace, FunctionGemma).
 */
export type InferenceModel = {
  inference: (intent: string, tools: ToolSchema[]) => Promise<FunctionCall[]>
}

// ============================================================================
// Tiered Analysis Types
// ============================================================================

/**
 * Individual static check result.
 */
export type StaticCheck = {
  name: string
  passed: boolean
  message?: string
}

/**
 * Result from Tier 1 static analysis.
 *
 * @remarks
 * Fast, free checks that catch common issues before
 * more expensive model-based or browser validation.
 */
export type StaticAnalysisResult = {
  passed: boolean
  tier: 1
  checks: StaticCheck[]
}

/**
 * Result from Tier 2 model-as-judge evaluation.
 *
 * @remarks
 * Uses a model to evaluate subjective quality aspects
 * that static analysis can't catch (naming, structure, composition).
 */
export type JudgeResult = {
  passed: boolean
  tier: 2
  score: number // 0-1 confidence
  reasoning: string
}

// ============================================================================
// Code Execution Types
// ============================================================================

/**
 * Sandbox configuration for code execution.
 *
 * @remarks
 * Configures OS-level sandboxing via bubblewrap (Linux) or Seatbelt (macOS).
 * Pattern validation provides an additional defense layer.
 */
export type SandboxConfig = {
  /** Directories allowed for write access */
  allowWrite?: string[]
  /** Directories denied for read access */
  denyRead?: string[]
  /** Domains allowed for network access */
  allowedDomains?: string[]
  /** Execution timeout in milliseconds */
  timeout?: number
}

/**
 * Source of a tool (for routing).
 */
export type ToolSource = 'local' | 'mcp' | 'a2a' | 'skill'

/**
 * Result from code execution.
 */
export type CodeExecutionResult = {
  success: boolean
  output?: unknown
  error?: string
  toolCalls?: Array<{ name: string; args: unknown; result: unknown }>
  duration?: number
}

// ============================================================================
// Preference Types (Hybrid UI)
// ============================================================================

/**
 * Structural block types from loom vocabulary.
 */
export type BlockType =
  | 'feed'
  | 'gallery'
  | 'card'
  | 'dialog'
  | 'disclosure'
  | 'wizard'
  | 'dashboard'
  | 'pool'
  | 'pipeline'

/**
 * Object grouping strategies.
 */
export type ObjectGrouping = 'nested' | 'relational' | 'list' | 'steps'

/**
 * Structural metadata extracted from generated code.
 */
export type StructuralMetadata = {
  objects: Array<{
    name: string
    type?: string
    grouping?: ObjectGrouping
  }>
  channel?: 'selection' | 'transition' | 'input' | 'output'
  loops?: Array<{ trigger: string; handler: string }>
  levers?: string[]
  block?: BlockType
}

/**
 * User preference profile for hybrid UI.
 *
 * @remarks
 * Allows users to specify familiar structures they prefer.
 * Generated content fills in dynamic parts while maintaining
 * structural consistency.
 */
export type UserPreferenceProfile = {
  /** Preferred block patterns */
  preferredBlocks?: BlockType[]
  /** Preferred object groupings */
  preferredGroupings?: ObjectGrouping[]
  /** Base templates to use as starting points */
  baseTemplates?: string[]
  /** Required structural patterns */
  requiredPatterns?: StructuralMetadata[]
}

// ============================================================================
// World Agent Configuration
// ============================================================================

/**
 * Handler functions for world agent events.
 */
export type WorldAgentHandlers = {
  generate: (args: { intent: string; context?: unknown }) => Promise<void>
  cancel: () => void
  feedback: (args: { result: StoryResult }) => void
  disconnect: () => void
  executeCode?: (args: { code: string; sandbox?: SandboxConfig }) => Promise<CodeExecutionResult>
  chainTools?: (args: { calls: FunctionCall[]; sequential?: boolean }) => Promise<ToolResult[]>
  resolveTool?: (args: { name: string; source?: ToolSource }) => Promise<ToolHandler | undefined>
}

/**
 * Configuration for createWorldAgent.
 */
export type WorldAgentConfig = {
  /** Tool registry for execution */
  tools: ToolRegistry
  /** Inference model for generation */
  model: InferenceModel
  /** Context budget manager */
  contextBudget?: ContextBudget
  /** Custom handlers (can override defaults) */
  customHandlers?: Partial<WorldAgentHandlers>
  /** Custom bThreads for constraints */
  customBThreads?: Record<string, RulesFunction>
  /** Analysis configuration */
  constraints?: {
    /** Skip Tier 2 model-as-judge */
    skipTier2?: boolean
    /** Which static checks to run */
    staticChecks?: string[]
  }
  /** User preferences for hybrid UI */
  preferences?: UserPreferenceProfile
}

// ============================================================================
// Training Types
// ============================================================================

/**
 * Trajectory with tiered analysis for training.
 */
export type TrajectoryWithTiers = {
  intent: string
  toolCalls: FunctionCall[]
  result: StoryResult
  structural?: StructuralMetadata
  tiers: {
    static: StaticAnalysisResult
    judge?: JudgeResult
    browser: StoryResult
  }
  reward?: number
}
