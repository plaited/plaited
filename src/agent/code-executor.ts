/**
 * Code executor with sandbox support.
 *
 * @remarks
 * Executes generated code with defense-in-depth:
 * 1. Pattern validation - Fast regex check blocks obvious unsafe patterns
 * 2. OS sandbox - Kernel-level filesystem/network restrictions (optional)
 *
 * The sandbox integration follows Anthropic's MCP sandboxing approach.
 */

import type { CodeExecutionResult, SandboxConfig, ToolHandler, ToolRegistry, ToolResult } from './agent.types.ts'

// ============================================================================
// Unsafe Pattern Detection
// ============================================================================

/**
 * Patterns that indicate potentially unsafe code.
 *
 * @remarks
 * These patterns are checked before any code execution.
 * They catch common security anti-patterns:
 * - Environment variable access
 * - Child process execution
 * - Dynamic code evaluation
 * - Dangerous global access
 */
const UNSAFE_PATTERNS = [
  // Environment access
  { pattern: /process\.env/, message: 'Environment variable access not allowed' },
  { pattern: /Bun\.env/, message: 'Bun environment access not allowed' },
  { pattern: /Deno\.env/, message: 'Deno environment access not allowed' },

  // Child process execution
  { pattern: /require\s*\(\s*['"]child_process['"]/, message: 'child_process module not allowed' },
  { pattern: /import\s+.*from\s*['"]child_process['"]/, message: 'child_process module not allowed' },
  { pattern: /Bun\.spawn/, message: 'Bun.spawn not allowed' },
  { pattern: /Deno\.run/, message: 'Deno.run not allowed' },

  // Dynamic code evaluation
  { pattern: /\beval\s*\(/, message: 'eval() not allowed' },
  { pattern: /\bFunction\s*\(/, message: 'Function constructor not allowed' },
  { pattern: /new\s+Function\s*\(/, message: 'new Function() not allowed' },

  // File system dangerous operations
  { pattern: /fs\.rmdir|fs\.rm\s*\(|rimraf/, message: 'Recursive delete operations not allowed' },
  { pattern: /fs\.unlink|Bun\.write\s*\([^,]+,\s*''?\s*\)/, message: 'File deletion operations restricted' },

  // Network dangerous operations
  { pattern: /\.listen\s*\(/, message: 'Server listening not allowed' },

  // Dangerous globals
  { pattern: /globalThis\[/, message: 'Dynamic global access not allowed' },
  { pattern: /window\[/, message: 'Dynamic window access not allowed' },
]

/**
 * Additional patterns that are suspicious but might be legitimate.
 */
const WARNING_PATTERNS = [
  { pattern: /fetch\s*\(/, message: 'Network requests should use allowedDomains' },
  { pattern: /XMLHttpRequest/, message: 'XHR should use allowedDomains' },
  { pattern: /import\s*\(/, message: 'Dynamic imports should be reviewed' },
]

/**
 * Check if code contains unsafe patterns.
 *
 * @param code - Code to check
 * @returns True if unsafe patterns detected
 */
export const hasUnsafePatterns = (code: string): boolean => {
  return UNSAFE_PATTERNS.some(({ pattern }) => pattern.test(code))
}

/**
 * Get all unsafe pattern matches in code.
 *
 * @param code - Code to check
 * @returns Array of matched unsafe pattern messages
 */
export const getUnsafePatterns = (code: string): string[] => {
  return UNSAFE_PATTERNS.filter(({ pattern }) => pattern.test(code)).map(({ message }) => message)
}

/**
 * Get warning patterns (suspicious but not blocking).
 *
 * @param code - Code to check
 * @returns Array of warning messages
 */
export const getWarningPatterns = (code: string): string[] => {
  return WARNING_PATTERNS.filter(({ pattern }) => pattern.test(code)).map(({ message }) => message)
}

// ============================================================================
// Code Executor Types
// ============================================================================

/**
 * Code executor interface.
 */
export type CodeExecutor = {
  /** Execute code and return result */
  execute: (code: string) => Promise<CodeExecutionResult>
  /** Validate code without executing */
  validate: (code: string) => ValidationResult
}

/**
 * Result from code validation.
 */
export type ValidationResult = {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Options for creating a code executor.
 */
export type CodeExecutorOptions = {
  /** Tool registry for tool execution */
  tools: ToolRegistry
  /** Sandbox configuration (optional) */
  sandbox?: SandboxConfig
  /** Custom unsafe patterns to add */
  additionalUnsafePatterns?: Array<{ pattern: RegExp; message: string }>
  /** Skip pattern validation (for trusted code) */
  skipPatternValidation?: boolean
}

// ============================================================================
// Code Executor Factory
// ============================================================================

/**
 * Creates a code executor with sandbox support.
 *
 * @param options - Executor options
 * @returns Code executor instance
 *
 * @remarks
 * The executor provides defense-in-depth:
 * 1. Pattern validation catches obvious unsafe code
 * 2. Sandboxed execution restricts runtime capabilities
 *
 * Tool calls made during execution are tracked and returned.
 */
export const createCodeExecutor = (options: CodeExecutorOptions): CodeExecutor => {
  const { tools, sandbox, additionalUnsafePatterns = [], skipPatternValidation = false } = options

  // Combine default and custom unsafe patterns
  const allUnsafePatterns = [...UNSAFE_PATTERNS, ...additionalUnsafePatterns]

  const validate = (code: string): ValidationResult => {
    const errors: string[] = []
    const warnings: string[] = []

    if (!skipPatternValidation) {
      // Check unsafe patterns
      for (const { pattern, message } of allUnsafePatterns) {
        if (pattern.test(code)) {
          errors.push(message)
        }
      }

      // Check warning patterns
      for (const { pattern, message } of WARNING_PATTERNS) {
        if (pattern.test(code)) {
          // Check if it's actually safe (e.g., fetch to allowed domain)
          if (sandbox?.allowedDomains?.length && pattern.source.includes('fetch')) {
            // Fetch might be okay if domains are restricted
            warnings.push(`${message} - allowedDomains configured`)
          } else {
            warnings.push(message)
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  const execute = async (code: string): Promise<CodeExecutionResult> => {
    const startTime = Date.now()
    const toolCalls: Array<{ name: string; args: unknown; result: unknown }> = []

    // Step 1: Pattern validation
    const validation = validate(code)
    if (!validation.valid) {
      return {
        success: false,
        error: `Unsafe patterns detected: ${validation.errors.join(', ')}`,
        duration: Date.now() - startTime,
      }
    }

    // Step 2: Create sandboxed tool wrappers
    const sandboxedTools: Record<string, ToolHandler> = {}

    for (const schema of tools.schemas) {
      sandboxedTools[schema.name] = async (args: Record<string, unknown>): Promise<ToolResult> => {
        // Execute the actual tool
        const result = await tools.execute({
          name: schema.name,
          arguments: JSON.stringify(args),
        })

        // Track the call
        toolCalls.push({
          name: schema.name,
          args,
          result: result.data,
        })

        return result
      }
    }

    // Step 3: Execute code in sandboxed context
    try {
      // Create a restricted execution context
      const context = {
        tools: sandboxedTools,
        console: {
          log: (..._args: unknown[]) => {
            /* captured or discarded */
          },
          error: (..._args: unknown[]) => {
            /* captured or discarded */
          },
          warn: (..._args: unknown[]) => {
            /* captured or discarded */
          },
        },
      }

      // Note: In production, this would use @anthropic-ai/sandbox-runtime
      // or Bun's isolate capabilities for true OS-level sandboxing.
      // This implementation provides pattern validation as first defense layer.

      // Create async function from code
      const asyncFn = new Function(
        'tools',
        'console',
        `
        return (async () => {
          ${code}
        })()
      `,
      )

      const result = await asyncFn(context.tools, context.console)

      return {
        success: true,
        output: result,
        toolCalls,
        duration: Date.now() - startTime,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        toolCalls,
        duration: Date.now() - startTime,
      }
    }
  }

  return { execute, validate }
}

// ============================================================================
// Sandbox Initialization (Placeholder)
// ============================================================================

/**
 * Initialize OS-level sandbox.
 *
 * @param config - Sandbox configuration
 * @returns Promise that resolves when sandbox is ready
 *
 * @remarks
 * In production, this would initialize @anthropic-ai/sandbox-runtime
 * with the provided configuration. The sandbox provides:
 * - Filesystem restrictions (allowWrite, denyRead)
 * - Network restrictions (allowedDomains)
 * - Process restrictions (no child spawning)
 *
 * This is a placeholder for the actual implementation.
 */
export const initializeSandbox = async (config: SandboxConfig): Promise<void> => {
  // Validate configuration
  if (config.timeout && config.timeout < 0) {
    throw new Error('Sandbox timeout must be non-negative')
  }

  // In production:
  // - On Linux: Initialize bubblewrap with seccomp filters
  // - On macOS: Initialize Seatbelt sandbox profile
  // - Configure filesystem mounts based on allowWrite/denyRead
  // - Configure network namespace for allowedDomains

  // For now, just validate the config structure
  const validPaths = (paths?: string[]): boolean => {
    if (!paths) return true
    return paths.every((p) => typeof p === 'string' && p.length > 0)
  }

  if (!validPaths(config.allowWrite) || !validPaths(config.denyRead) || !validPaths(config.allowedDomains)) {
    throw new Error('Invalid sandbox configuration paths')
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Wrap tool registry for execution tracking.
 *
 * @param registry - Original tool registry
 * @param onCall - Callback when tool is called
 * @returns Wrapped registry
 */
export const wrapToolRegistry = (
  registry: ToolRegistry,
  onCall: (name: string, args: unknown, result: ToolResult) => void,
): ToolRegistry => {
  return {
    ...registry,
    execute: async (call) => {
      const result = await registry.execute(call)
      onCall(call.name, JSON.parse(call.arguments), result)
      return result
    },
  }
}

/**
 * Execute code with timeout.
 *
 * @param executor - Code executor
 * @param code - Code to execute
 * @param timeout - Timeout in milliseconds
 * @returns Execution result or timeout error
 */
export const executeWithTimeout = async (
  executor: CodeExecutor,
  code: string,
  timeout: number,
): Promise<CodeExecutionResult> => {
  const timeoutPromise = new Promise<CodeExecutionResult>((resolve) => {
    setTimeout(() => {
      resolve({
        success: false,
        error: `Execution timed out after ${timeout}ms`,
      })
    }, timeout)
  })

  return Promise.race([executor.execute(code), timeoutPromise])
}
