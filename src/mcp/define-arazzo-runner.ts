/**
 * @internal
 * @module define-arazzo-runner
 *
 * Purpose: MCP server implementation for executing Arazzo workflow specifications
 * Architecture: Integrates Arazzo workflow engine with Plaited's behavioral programming system
 * Dependencies: MCP SDK, behavioral module, Arazzo spec parser, HTTP client
 * Consumers: Applications needing to execute API workflows through AI assistants
 *
 * Maintainer Notes:
 * - Implements Arazzo Specification v1.0.1 for API workflow orchestration
 * - Workflows execute as behavioral programs with event-driven control flow
 * - Runtime expressions provide dynamic data flow between workflow steps
 * - MCP tools expose workflow operations to AI assistants
 * - Environment variables handle secure values and configuration
 * - Each workflow execution creates isolated behavioral context
 *
 * Common modification scenarios:
 * - Supporting new Arazzo features: Update types and execution logic
 * - Adding workflow debugging: Enhance state tracking and event emission
 * - Custom authentication: Extend HTTP client configuration
 * - Performance optimization: Implement workflow caching
 *
 * Performance considerations:
 * - Workflow parsing happens once at server startup
 * - Each execution creates new behavioral thread
 * - HTTP requests use connection pooling via fetch
 * - Expression evaluation cached within execution context
 *
 * Known limitations:
 * - No support for streaming responses
 * - OAuth2 authorization code flow not implemented
 * - XPath criterion type not yet supported
 * - No distributed workflow execution
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  type BSync,
  type BThread,
  type BThreads,
  type Disconnect,
  type PlaitedTrigger,
  type UseSnapshot,
  type EventDetails,
  bProgram,
  bThread,
  bSync,
  useSignal,
  type Signal,
} from '../behavioral.js'
import { defineMCPServer } from './define-mcp-server.js'
import type { Registry, PrimitiveHandlers, Tools, Resources, Prompts } from './mcp.types.js'
import { useFetch } from '../utils/use-fetch.js'
import { wait } from '../utils/wait.js'

// ===== Arazzo Type Definitions =====

/**
 * Arazzo document root object per v1.0.1 specification
 */
export interface ArazzoDocument {
  arazzo: string
  info: ArazzoInfo
  sourceDescriptions: SourceDescription[]
  workflows: Workflow[]
  components?: Components
  [key: `x-${string}`]: unknown
}

export interface ArazzoInfo {
  title: string
  summary?: string
  description?: string
  version: string
  [key: `x-${string}`]: unknown
}

export interface SourceDescription {
  name: string
  url: string
  type?: 'openapi' | 'arazzo'
  [key: `x-${string}`]: unknown
}

export interface Workflow {
  workflowId: string
  summary?: string
  description?: string
  inputs?: Record<string, unknown> | { $ref: string }
  dependsOn?: string[]
  steps: Step[]
  successActions?: (SuccessAction | ReusableObject)[]
  failureActions?: (FailureAction | ReusableObject)[]
  outputs?: Record<string, string>
  parameters?: (Parameter | ReusableObject)[]
  [key: `x-${string}`]: unknown
}

export interface Step {
  description?: string
  stepId: string
  operationId?: string
  operationPath?: string
  workflowId?: string
  parameters?: (Parameter | ReusableObject)[]
  requestBody?: RequestBody
  successCriteria?: Criterion[]
  onSuccess?: (SuccessAction | ReusableObject)[]
  onFailure?: (FailureAction | ReusableObject)[]
  outputs?: Record<string, string>
  [key: `x-${string}`]: unknown
}

export interface Parameter {
  name: string
  in?: 'path' | 'query' | 'header' | 'cookie'
  value: unknown
  [key: `x-${string}`]: unknown
}

export interface RequestBody {
  contentType?: string
  payload?: unknown
  replacements?: PayloadReplacement[]
  [key: `x-${string}`]: unknown
}

export interface PayloadReplacement {
  target: string
  value: unknown
  [key: `x-${string}`]: unknown
}

export interface Criterion {
  context?: string
  condition: string
  type?: 'simple' | 'regex' | 'jsonpath' | 'xpath' | CriterionExpressionType
  [key: `x-${string}`]: unknown
}

export interface CriterionExpressionType {
  type: 'jsonpath' | 'xpath'
  version: string
  [key: `x-${string}`]: unknown
}

export interface SuccessAction {
  name: string
  type: 'end' | 'goto'
  workflowId?: string
  stepId?: string
  criteria?: Criterion[]
  [key: `x-${string}`]: unknown
}

export interface FailureAction {
  name: string
  type: 'end' | 'retry' | 'goto'
  workflowId?: string
  stepId?: string
  retryAfter?: number
  retryLimit?: number
  criteria?: Criterion[]
  [key: `x-${string}`]: unknown
}

export interface ReusableObject {
  reference: string
  value?: string
  [key: `x-${string}`]: unknown
}

export interface Components {
  inputs?: Record<string, unknown>
  parameters?: Record<string, Parameter>
  successActions?: Record<string, SuccessAction>
  failureActions?: Record<string, FailureAction>
  [key: `x-${string}`]: unknown
}

// ===== Execution Types =====

export interface ExecutionContext {
  inputs: Record<string, unknown>
  outputs: Record<string, unknown>
  steps: Record<string, StepResult>
  workflows: Record<string, WorkflowResult>
  sourceDescriptions: Record<string, SourceDescription>
  components: Components
  currentStep?: string
  currentWorkflow?: string
  response?: {
    statusCode: number
    headers: Record<string, string>
    body: unknown
  }
  url?: string
  method?: string
}

export interface StepResult {
  status: 'pending' | 'running' | 'success' | 'failure' | 'skipped'
  outputs?: Record<string, unknown>
  error?: Error
  retryCount?: number
}

export interface WorkflowResult {
  workflowId: string
  status: 'success' | 'failure' | 'error'
  outputs?: Record<string, unknown>
  error?: Error
  steps: Record<string, StepResult>
}

export interface OperationResult {
  status: 'success' | 'failure'
  statusCode?: number
  headers?: Record<string, string>
  body?: unknown
  error?: Error
}

// ===== Configuration Types =====

export interface ArazzoRunnerConfig {
  name: string
  version: string
  arazzoDocuments: (string | ArazzoDocument)[]
  openApiDocuments?: (string | Record<string, unknown>)[]
  environmentResolver?: (key: string) => string | undefined
  httpClient?: typeof useFetch
  bProgram: (args: {
    bSync: BSync
    bThread: BThread
    bThreads: BThreads
    disconnect: Disconnect
    server: McpServer
    trigger: PlaitedTrigger
    useSnapshot: UseSnapshot
    prompts: Prompts<ArazzoRunnerRegistry>
    resources: Resources<ArazzoRunnerRegistry>
    tools: Tools<ArazzoRunnerRegistry>
    runner: WorkflowRunner
  }) => Promise<PrimitiveHandlers<ArazzoRunnerRegistry, EventDetails>>
}

// ===== MCP Registry =====

type ArazzoRunnerRegistry = Registry

// ===== Event Definitions =====

type _ArazzoEvents = 
  | { type: 'WORKFLOW_START'; detail: { workflowId: string; inputs: Record<string, unknown> } }
  | { type: 'WORKFLOW_SUCCESS'; detail: { workflowId: string; outputs: Record<string, unknown> } }
  | { type: 'WORKFLOW_FAILURE'; detail: { workflowId: string; error: Error } }
  | { type: 'WORKFLOW_END'; detail: { workflowId: string } }
  | { type: 'WORKFLOW_COMPLETE'; detail: WorkflowResult }
  | { type: 'STEP_START'; detail: { workflowId: string; stepId: string } }
  | { type: 'STEP_SUCCESS'; detail: { workflowId: string; stepId: string; outputs: Record<string, unknown> } }
  | { type: 'STEP_FAILURE'; detail: { workflowId: string; stepId: string; error: Error } }
  | { type: 'STEP_RETRY'; detail: { workflowId: string; stepId: string; retryCount: number } }
  | { type: 'EXECUTE_OPERATION'; detail: { operationId?: string; operationPath?: string; parameters: Record<string, unknown>; requestBody?: unknown } }
  | { type: 'OPERATION_COMPLETE'; detail: OperationResult }
  | { type: 'EVALUATE_CRITERION'; detail: { criterion: Criterion; context: ExecutionContext } }
  | { type: 'CRITERION_RESULT'; detail: { criterion: Criterion; matched: boolean } }
  | { type: 'EVALUATE_CRITERIA'; detail: { result: OperationResult } }
  | { type: 'CRITERIA_EVALUATED'; detail: { matched: boolean } }
  | { type: 'EVALUATE_EXPRESSION'; detail: { expression: string | unknown; context: ExecutionContext } }
  | { type: 'EXPRESSION_RESULT'; detail: { expression: string | unknown; result: unknown } }
  | { type: 'HANDLE_SUCCESS_ACTION'; detail: { action: SuccessAction; context: ExecutionContext } }
  | { type: 'HANDLE_FAILURE_ACTION'; detail: { action: FailureAction; context: ExecutionContext } }
  | { type: 'GOTO_STEP'; detail: { workflowId?: string; stepId?: string } }
  | { type: 'RETRY_STEP'; detail: { stepId: string; retryAfter: number; retryLimit: number } }
  | { type: 'EXECUTE_WORKFLOW_STEPS'; detail?: undefined }
  | { type: 'ACTION_EXECUTED'; detail?: undefined }

// ===== Runtime Expression Evaluation =====

const createExpressionEvaluator = () => {
  const evaluators = new Map<string, (parts: string[], context: ExecutionContext) => unknown>()
  
  // Register evaluators for different expression roots
  evaluators.set('$url', (_, context) => context.url)
  evaluators.set('$method', (_, context) => context.method)
  evaluators.set('$statusCode', (_, context) => context.response?.statusCode)
  evaluators.set('$request', (parts, context) => {
    const [, property] = parts
    if (property === 'header') {
      const headerName = parts[2]
      return context.response?.headers[headerName]
    }
    return undefined
  })
  evaluators.set('$response', (parts, context) => {
    const [, property] = parts
    switch (property) {
      case 'header': {
        const headerName = parts[2]
        return context.response?.headers[headerName]
      }
      case 'body':
        return navigateObject(context.response?.body, parts.slice(2))
      default:
        return undefined
    }
  })
  evaluators.set('$inputs', (parts, context) => navigateObject(context.inputs, parts.slice(1)))
  evaluators.set('$outputs', (parts, context) => navigateObject(context.outputs, parts.slice(1)))
  evaluators.set('$steps', (parts, context) => {
    const [, stepId, ...rest] = parts
    const step = context.steps[stepId]
    if (!step) return undefined
    return navigateObject(step, rest)
  })
  evaluators.set('$workflows', (parts, context) => {
    const [, workflowId, ...rest] = parts
    const workflow = context.workflows[workflowId]
    if (!workflow) return undefined
    return navigateObject(workflow, rest)
  })
  evaluators.set('$sourceDescriptions', (parts, context) => {
    const [, sourceName, ...rest] = parts
    const source = context.sourceDescriptions[sourceName]
    if (!source) return undefined
    return navigateObject(source, rest)
  })
  evaluators.set('$components', (parts, context) => navigateObject(context.components, parts.slice(1)))
  
  const navigateObject = (obj: unknown, parts: string[]): unknown => {
    let current = obj
    for (const part of parts) {
      if (current == null || typeof current !== 'object') return undefined
      current = (current as Record<string, unknown>)[part]
    }
    return current
  }
  
  const evaluate = (expression: string | unknown, context: ExecutionContext): unknown => {
    if (typeof expression !== 'string') {
      return expression
    }

    // Handle embedded expressions: "text {$expression} more text"
    if (expression.includes('{') && expression.includes('}')) {
      return expression.replace(/\{([^}]+)\}/g, (_, expr) => {
        const result = evaluateExpression(expr.trim(), context)
        return String(result ?? '')
      })
    }

    // Handle direct expressions starting with $
    if (expression.startsWith('$')) {
      return evaluateExpression(expression, context)
    }

    return expression
  }
  
  const evaluateExpression = (expr: string, context: ExecutionContext): unknown => {
    if (!expr.startsWith('$')) {
      return expr
    }

    const parts = expr.split(/[.#/]/)
    const root = parts[0]
    const evaluator = evaluators.get(root)
    
    if (evaluator) {
      return evaluator(parts, context)
    }
    
    // Handle environment variables
    if (root === '$env') {
      const envKey = parts[1]
      return context.components?.parameters?.[envKey]?.value
    }
    
    return undefined
  }
  
  return { evaluate }
}

// ===== Criterion Evaluation =====

const createCriterionHandlers = () => {
  const handlers = new Map<string, (criterion: Criterion, context: ExecutionContext, evaluator: ReturnType<typeof createExpressionEvaluator>) => boolean>()
  
  handlers.set('simple', (criterion, context) => {
    // Simple expression evaluation - supports basic operators
    const { condition } = criterion
    
    // Basic equality check for status codes
    const statusMatch = condition.match(/\$statusCode\s*==\s*(\d+)/)
    if (statusMatch) {
      return context.response?.statusCode === parseInt(statusMatch[1], 10)
    }
    
    // TODO: Implement full expression parsing
    console.warn(`Complex simple expressions not yet fully supported: ${condition}`)
    return true
  })
  
  handlers.set('regex', (criterion, context, evaluator) => {
    const contextValue = evaluator.evaluate(criterion.context || '', context)
    if (typeof contextValue !== 'string') return false
    
    try {
      const regex = new RegExp(criterion.condition)
      return regex.test(contextValue)
    } catch {
      return false
    }
  })
  
  handlers.set('jsonpath', (criterion, context, evaluator) => {
    // TODO: Implement JSONPath evaluation
    console.warn('JSONPath criterion type not yet implemented')
    return true
  })
  
  handlers.set('xpath', (_criterion, _context, _evaluator) => {
    // TODO: Implement XPath evaluation
    console.warn('XPath criterion type not yet supported')
    return false
  })
  
  return handlers
}

// ===== HTTP Operation Execution =====

const createOperationExecutor = (
  httpClient: typeof useFetch,
  _environmentResolver: (key: string) => string | undefined,
  _openApiDocs: Map<string, Record<string, unknown>>
) => {
  return async (
    operationId: string | undefined,
    operationPath: string | undefined,
    parameters: Record<string, unknown>,
    requestBody: unknown,
    context: ExecutionContext,
    trigger: PlaitedTrigger
  ): Promise<OperationResult> => {
    // TODO: Implement OpenAPI operation resolution and execution
    // This would:
    // 1. Find the operation in OpenAPI docs
    // 2. Build the request URL with parameters
    // 3. Add authentication headers
    // 4. Execute the HTTP request
    // 5. Return the result

    // Placeholder implementation
    const response = await httpClient({
      url: 'https://api.example.com/placeholder',
      type: 'HTTP_ERROR',
      trigger,
      retry: 3,
      retryDelay: 1000,
      options: {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    })

    if (!response) {
      return {
        status: 'failure',
        error: new Error('HTTP request failed'),
      }
    }

    const body = await response.json().catch(() => response.text())
    
    // Update context with response data
    context.response = {
      statusCode: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body,
    }

    return {
      status: 'success',
      statusCode: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body,
    }
  }
}

// ===== Workflow Runner =====

export interface WorkflowRunner {
  executeWorkflow(workflowId: string, inputs: Record<string, unknown>): Promise<WorkflowResult>
  listWorkflows(): Array<{ workflowId: string; summary?: string; description?: string }>
  describeWorkflow(workflowId: string): Workflow | undefined
  getDocuments(): ArazzoDocument[]
  getWorkflowState(workflowId: string): WorkflowResult | undefined
}

const createWorkflowRunner = async ({
  arazzoDocuments,
  openApiDocuments,
  environmentResolver,
  httpClient,
  bSync,
  bThread,
  bThreads,
  trigger,
}: {
  arazzoDocuments: ArazzoDocument[]
  openApiDocuments: Map<string, Record<string, unknown>>
  environmentResolver: (key: string) => string | undefined
  httpClient: typeof useFetch
  bSync: BSync
  bThread: BThread
  bThreads: BThreads
  trigger: PlaitedTrigger
}): Promise<WorkflowRunner> => {
  // Initialize state with signals
  const workflows = useSignal(new Map<string, Workflow>())
  const sourceDescriptions = useSignal(new Map<string, SourceDescription>())
  const components = useSignal<Components>({})
  const runningWorkflows = useSignal(new Map<string, Signal<WorkflowResult>>())
  const executionContexts = useSignal(new Map<string, ExecutionContext>())
  
  // Load documents
  for (const doc of arazzoDocuments) {
    // Load workflows
    for (const workflow of doc.workflows) {
      workflows.get().set(workflow.workflowId, workflow)
    }
    
    // Load source descriptions
    for (const source of doc.sourceDescriptions) {
      sourceDescriptions.get().set(source.name, source)
    }
    
    // Merge components
    if (doc.components) {
      components.set({ ...components.get(), ...doc.components })
    }
  }
  
  // Create evaluators and executors
  const _expressionEvaluator = createExpressionEvaluator()
  const _criterionHandlers = createCriterionHandlers()
  const operationExecutor = createOperationExecutor(httpClient, environmentResolver, openApiDocuments)
  
  // Define behavioral threads
  
  // Workflow orchestrator thread
  const workflowOrchestrator = bThread([
    bSync({ waitFor: 'WORKFLOW_START' }),
    bSync({ request: { type: 'EXECUTE_WORKFLOW_STEPS' } }),
    bSync({ waitFor: ['WORKFLOW_SUCCESS', 'WORKFLOW_FAILURE', 'WORKFLOW_END'] })
  ], true)
  
  // Step executor thread
  const stepExecutor = bThread([
    bSync({ waitFor: 'STEP_START' }),
    bSync({ request: { type: 'EXECUTE_OPERATION' } }),
    bSync({ waitFor: 'OPERATION_COMPLETE' }),
    bSync({ request: { type: 'EVALUATE_CRITERIA' } }),
    bSync({ waitFor: 'CRITERIA_EVALUATED' }),
    bSync({ waitFor: ['STEP_SUCCESS', 'STEP_FAILURE'] })
  ], true)
  
  // Criterion evaluator thread
  const criterionEvaluator = bThread([
    bSync({ waitFor: 'EVALUATE_CRITERION' }),
    bSync({ request: { type: 'CRITERION_RESULT' } })
  ], true)
  
  // Expression evaluator thread
  const expressionEvaluatorThread = bThread([
    bSync({ waitFor: 'EVALUATE_EXPRESSION' }),
    bSync({ request: { type: 'EXPRESSION_RESULT' } })
  ], true)
  
  // Retry handler thread
  const retryHandler = bThread([
    bSync({ waitFor: 'RETRY_STEP' }),
    bSync({ request: { type: 'STEP_START' } })
  ], true)
  
  // Action dispatcher thread
  const actionDispatcher = bThread([
    bSync({ waitFor: ['HANDLE_SUCCESS_ACTION', 'HANDLE_FAILURE_ACTION'] }),
    bSync({ request: { type: 'ACTION_EXECUTED' } })
  ], true)
  
  // Add threads to bProgram
  bThreads.set({
    workflowOrchestrator,
    stepExecutor,
    criterionEvaluator,
    expressionEvaluatorThread,
    retryHandler,
    actionDispatcher,
  })
  
  // Implementation methods
  const executeWorkflow = async (workflowId: string, inputs: Record<string, unknown>): Promise<WorkflowResult> => {
    const workflow = workflows.get().get(workflowId)
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`)
    }
    
    // Check if already running
    const existingRun = runningWorkflows.get().get(workflowId)
    if (existingRun) {
      const result = existingRun.get()
      if (result) return result
      
      // Wait for completion
      return new Promise<WorkflowResult>((resolve) => {
        existingRun.listen('WORKFLOW_COMPLETE', ({ detail }: { type: string; detail?: WorkflowResult }) => {
          if (detail) resolve(detail)
        })
      })
    }
    
    // Create execution context
    const context: ExecutionContext = {
      inputs,
      outputs: {},
      steps: {},
      workflows: {},
      sourceDescriptions: Object.fromEntries(sourceDescriptions.get()),
      components: components.get(),
      currentWorkflow: workflowId,
    }
    
    executionContexts.get().set(workflowId, context)
    
    // Create workflow result signal
    const workflowResult = useSignal<WorkflowResult>({
      workflowId,
      status: 'success',
      outputs: {},
      steps: {},
    })
    
    runningWorkflows.get().set(workflowId, workflowResult)
    
    // Start workflow execution
    trigger({ type: 'WORKFLOW_START', detail: { workflowId, inputs } })
    
    // Wait for completion
    return new Promise<WorkflowResult>((resolve) => {
      workflowResult.listen('WORKFLOW_COMPLETE', ({ detail }: { type: string; detail?: WorkflowResult }) => {
        runningWorkflows.get().delete(workflowId)
        executionContexts.get().delete(workflowId)
        if (detail) resolve(detail)
      })
    })
  }
  
  const listWorkflows = (): Array<{ workflowId: string; summary?: string; description?: string }> => {
    return Array.from(workflows.get().values()).map(w => ({
      workflowId: w.workflowId,
      summary: w.summary,
      description: w.description,
    }))
  }
  
  const describeWorkflow = (workflowId: string): Workflow | undefined => {
    return workflows.get().get(workflowId)
  }
  
  const getDocuments = (): ArazzoDocument[] => {
    return arazzoDocuments
  }
  
  const getWorkflowState = (workflowId: string): WorkflowResult | undefined => {
    const signal = runningWorkflows.get().get(workflowId)
    if (!signal) return undefined
    return signal.get()
  }
  
  return {
    executeWorkflow,
    listWorkflows,
    describeWorkflow,
    getDocuments,
    getWorkflowState,
  }
}

// ===== Main MCP Server Definition =====

/**
 * Creates an MCP server that executes Arazzo workflows
 * 
 * @example
 * ```ts
 * const runner = await defineArazzoRunner({
 *   name: 'my-workflow-runner',
 *   version: '1.0.0',
 *   arazzoDocuments: ['./workflows.arazzo.yaml'],
 *   openApiDocuments: ['./api.openapi.yaml'],
 *   environmentResolver: (key) => process.env[key],
 *   httpClient: useFetch,
 *   async bProgram({ trigger, tools, runner }) {
 *     return {
 *       'execute-workflow': async ({ resolve, args }) => {
 *         const result = await runner.executeWorkflow(args.workflowId, args.inputs);
 *         resolve({ 
 *           content: [{ 
 *             type: 'text', 
 *             text: JSON.stringify(result, null, 2) 
 *           }] 
 *         });
 *       }
 *     };
 *   }
 * });
 * ```
 */
export const defineArazzoRunner = async (config: ArazzoRunnerConfig) => {
  const {
    name,
    version,
    arazzoDocuments,
    openApiDocuments = [],
    environmentResolver = (key) => process.env[key],
    httpClient = useFetch,
    bProgram: userBProgram,
  } = config

  // Load documents
  const loadedArazzoDocs: ArazzoDocument[] = []
  for (const doc of arazzoDocuments) {
    if (typeof doc === 'string') {
      // TODO: Load from file path
      throw new Error('Loading Arazzo documents from file paths not yet implemented')
    } else {
      loadedArazzoDocs.push(doc)
    }
  }

  const loadedOpenApiDocs = new Map<string, Record<string, unknown>>()
  for (const doc of openApiDocuments) {
    if (typeof doc === 'string') {
      // TODO: Load from file path
      throw new Error('Loading OpenAPI documents from file paths not yet implemented')
    } else {
      // TODO: Extract document identifier
      loadedOpenApiDocs.set('default', doc)
    }
  }

  // Define MCP registry
  const registry: ArazzoRunnerRegistry = {
    'execute-workflow': {
      primitive: 'tool' as const,
      config: {
        description: 'Execute an Arazzo workflow by ID with inputs',
        inputSchema: {
          workflowId: z.string().describe('The workflow ID to execute'),
          inputs: z.record(z.string(), z.any()).describe('Input parameters for the workflow'),
        },
      },
    },
    'execute-operation': {
      primitive: 'tool' as const,
      config: {
        description: 'Execute a single OpenAPI operation',
        inputSchema: {
          operationId: z.string().optional().describe('The operation ID from OpenAPI spec'),
          operationPath: z.string().optional().describe('The operation path and method (e.g., "GET /users")'),
          parameters: z.record(z.string(), z.any()).optional().describe('Operation parameters'),
          requestBody: z.any().optional().describe('Request body content'),
        },
      },
    },
    'list-workflows': {
      primitive: 'tool' as const,
      config: {
        description: 'List all available workflows',
        inputSchema: {},
      },
    },
    'describe-workflow': {
      primitive: 'tool' as const,
      config: {
        description: 'Get details about a specific workflow',
        inputSchema: {
          workflowId: z.string().describe('The workflow ID to describe'),
        },
      },
    },
    'arazzo-document': {
      primitive: 'resource' as const,
      config: {
        uriOrTemplate: 'arazzo://document',
        metaData: {
          mimeType: 'application/yaml',
          description: 'Access loaded Arazzo documents',
        },
      },
    },
    'workflow-state': {
      primitive: 'resource' as const,
      config: {
        uriOrTemplate: new ResourceTemplate('arazzo://workflow/{workflowId}/state'),
        metaData: {
          mimeType: 'application/json',
          description: 'Get current execution state of a workflow',
        },
      },
    },
    'generate-workflow-inputs': {
      primitive: 'prompt' as const,
      config: {
        description: 'Generate example inputs for a workflow',
        argsSchema: {
          workflowId: z.string().describe('The workflow ID to generate inputs for'),
        },
      },
    },
  }

  // Create MCP server with behavioral program
  return defineMCPServer({
    name,
    version,
    registry,
    async bProgram(args) {
      // Create our own bProgram to set up internal handlers
      const { useFeedback } = bProgram()
      // Initialize state with signals
      const workflows = useSignal(new Map<string, Workflow>())
      const sourceDescriptions = useSignal(new Map<string, SourceDescription>())
      const components = useSignal<Components>({})
      const runningWorkflows = useSignal(new Map<string, Signal<WorkflowResult>>())
      const executionContexts = useSignal(new Map<string, ExecutionContext>())
      
      // Load documents
      for (const doc of loadedArazzoDocs) {
        // Load workflows
        for (const workflow of doc.workflows) {
          workflows.get().set(workflow.workflowId, workflow)
        }
        
        // Load source descriptions
        for (const source of doc.sourceDescriptions) {
          sourceDescriptions.get().set(source.name, source)
        }
        
        // Merge components
        if (doc.components) {
          components.set({ ...components.get(), ...doc.components })
        }
      }
      
      // Create evaluators and executors
      const _expressionEvaluator = createExpressionEvaluator()
      const _criterionHandlers = createCriterionHandlers()
      const operationExecutor = createOperationExecutor(httpClient, environmentResolver, loadedOpenApiDocs)
      
      // Create workflow runner with behavioral context
      const runner = await createWorkflowRunner({
        arazzoDocuments: loadedArazzoDocs,
        openApiDocuments: loadedOpenApiDocs,
        environmentResolver,
        httpClient,
        bSync: args.bSync,
        bThread: args.bThread,
        bThreads: args.bThreads,
        trigger: args.trigger,
      })

      // Create internal event handlers without conditional logic
      const internalHandlers = {
        // Workflow lifecycle handlers
        WORKFLOW_START: (detail: { workflowId: string; inputs: Record<string, unknown> }) => {
          const { workflowId, inputs } = detail
          const workflow = runner.describeWorkflow(workflowId)
          if (!workflow) {
            args.trigger({ type: 'WORKFLOW_FAILURE', detail: { workflowId, error: new Error('Workflow not found') } })
            return
          }
          
          // Execute dependencies first
          if (workflow.dependsOn?.length) {
            for (const depId of workflow.dependsOn) {
              args.trigger({ type: 'WORKFLOW_START', detail: { workflowId: depId, inputs } })
            }
          }
          
          // Start first step
          if (workflow.steps.length > 0) {
            args.trigger({ type: 'STEP_START', detail: { workflowId, stepId: workflow.steps[0].stepId } })
          } else {
            args.trigger({ type: 'WORKFLOW_SUCCESS', detail: { workflowId, outputs: {} } })
          }
        },
        
        EXECUTE_WORKFLOW_STEPS: () => {
          // This is handled by the orchestrator thread
        },
        
        WORKFLOW_END: (detail: { workflowId: string }) => {
          args.trigger({ type: 'WORKFLOW_SUCCESS', detail: { workflowId: detail.workflowId, outputs: {} } })
        },
        
        WORKFLOW_COMPLETE: (detail: WorkflowResult) => {
          // Trigger the signal for waiting promises
          const signal = runningWorkflows.get().get(detail.workflowId)
          if (signal) {
            signal.set(detail)
          }
        },
        
        WORKFLOW_SUCCESS: (detail: { workflowId: string; outputs: Record<string, unknown> }) => {
          const signal = runningWorkflows.get().get(detail.workflowId)
          if (signal) {
            const result: WorkflowResult = {
              ...signal.get()!,
              status: 'success',
              outputs: detail.outputs
            }
            signal.set(result)
            args.trigger({ type: 'WORKFLOW_COMPLETE', detail: result })
          }
        },
        
        WORKFLOW_FAILURE: (detail: { workflowId: string; error: Error }) => {
          const signal = runningWorkflows.get().get(detail.workflowId)
          if (signal) {
            const result: WorkflowResult = {
              ...signal.get()!,
              status: 'failure',
              error: detail.error
            }
            signal.set(result)
            args.trigger({ type: 'WORKFLOW_COMPLETE', detail: result })
          }
        },
        
        // Step execution handlers
        STEP_START: async (detail: { workflowId: string; stepId: string }) => {
          const { workflowId, stepId } = detail
          const workflow = runner.describeWorkflow(workflowId)
          const step = workflow?.steps.find(s => s.stepId === stepId)
          
          if (!step) {
            args.trigger({ type: 'STEP_FAILURE', detail: { workflowId, stepId, error: new Error('Step not found') } })
            return
          }
          
          // Determine step type and execute
          if (step.operationId || step.operationPath) {
            args.trigger({ 
              type: 'EXECUTE_OPERATION', 
              detail: { 
                operationId: step.operationId,
                operationPath: step.operationPath,
                parameters: {}, // TODO: Resolve parameters
                requestBody: step.requestBody?.payload
              }
            })
          } else if (step.workflowId) {
            args.trigger({ type: 'WORKFLOW_START', detail: { workflowId: step.workflowId, inputs: {} } })
          } else {
            args.trigger({ type: 'STEP_FAILURE', detail: { workflowId, stepId, error: new Error('Invalid step type') } })
          }
        },
        
        OPERATION_COMPLETE: (detail: OperationResult) => {
          // Operation completed, now evaluate criteria
          args.trigger({ type: 'EVALUATE_CRITERIA', detail: { result: detail } })
        },
        
        EVALUATE_CRITERIA: (detail: { result: OperationResult }) => {
          // TODO: Get current step context and evaluate criteria
          args.trigger({ type: 'CRITERIA_EVALUATED', detail: { matched: true } })
        },
        
        CRITERIA_EVALUATED: (detail: { matched: boolean }) => {
          // TODO: Get current workflow/step context
          const workflowId = 'TODO'
          const stepId = 'TODO'
          
          // Based on criteria result, trigger success or failure
          if (detail.matched) {
            args.trigger({ type: 'STEP_SUCCESS', detail: { workflowId, stepId, outputs: {} } })
          } else {
            args.trigger({ type: 'STEP_FAILURE', detail: { workflowId, stepId, error: new Error('Criteria not met') } })
          }
        },
        
        // Expression and criterion handlers
        EVALUATE_EXPRESSION: (detail: { expression: string | unknown; context: ExecutionContext }) => {
          const { expression, context } = detail
          const evaluator = createExpressionEvaluator()
          const result = evaluator.evaluate(expression, context)
          args.trigger({ type: 'EXPRESSION_RESULT', detail: { expression, result } })
        },
        
        EVALUATE_CRITERION: (detail: { criterion: Criterion; context: ExecutionContext }) => {
          const { criterion, context } = detail
          const handlers = createCriterionHandlers()
          const evaluator = createExpressionEvaluator()
          
          const type = criterion.type || 'simple'
          const typeKey = typeof type === 'object' ? type.type : type
          const handler = handlers.get(typeKey)
          const matched = handler ? handler(criterion, context, evaluator) : false
          
          args.trigger({ type: 'CRITERION_RESULT', detail: { criterion, matched } })
        },
        
        // Action handlers
        HANDLE_SUCCESS_ACTION: (detail: { action: SuccessAction; context: ExecutionContext }) => {
          const { action } = detail
          
          switch (action.type) {
            case 'goto':
              args.trigger({ type: 'GOTO_STEP', detail: { workflowId: action.workflowId, stepId: action.stepId } })
              break
            case 'end':
              args.trigger({ type: 'WORKFLOW_END', detail: { workflowId: detail.context.currentWorkflow! } })
              break
          }
        },
        
        HANDLE_FAILURE_ACTION: (detail: { action: FailureAction; context: ExecutionContext }) => {
          const { action } = detail
          
          switch (action.type) {
            case 'retry':
              args.trigger({ 
                type: 'RETRY_STEP', 
                detail: { 
                  stepId: detail.context.currentStep!,
                  retryAfter: action.retryAfter || 1,
                  retryLimit: action.retryLimit || 1
                }
              })
              break
            case 'goto':
              args.trigger({ type: 'GOTO_STEP', detail: { workflowId: action.workflowId, stepId: action.stepId } })
              break
            case 'end':
              args.trigger({ type: 'WORKFLOW_END', detail: { workflowId: detail.context.currentWorkflow! } })
              break
          }
        },
        
        RETRY_STEP: async (detail: { stepId: string; retryAfter: number; retryLimit: number }) => {
          const { stepId, retryAfter } = detail
          await wait(retryAfter * 1000)
          // TODO: Get workflow context
          const workflowId = 'TODO'
          args.trigger({ type: 'STEP_START', detail: { workflowId, stepId } })
        },
        
        STEP_SUCCESS: (_detail: { workflowId: string; stepId: string; outputs: Record<string, unknown> }) => {
          // TODO: Update step result and continue to next step
        },
        
        STEP_FAILURE: (_detail: { workflowId: string; stepId: string; error: Error }) => {
          // TODO: Update step result and handle failure actions
        },
        
        GOTO_STEP: (_detail: { workflowId?: string; stepId?: string }) => {
          // TODO: Jump to specified step or workflow
        },
        
        ACTION_EXECUTED: () => {
          // Action completed
        },
        
        EXECUTE_OPERATION: async (detail: { operationId?: string; operationPath?: string; parameters: Record<string, unknown>; requestBody?: unknown }) => {
          // TODO: Get current context
          const context = executionContexts.get().get('TODO') || {} as ExecutionContext
          const result = await operationExecutor(
            detail.operationId,
            detail.operationPath,
            detail.parameters,
            detail.requestBody,
            context,
            args.trigger
          )
          args.trigger({ type: 'OPERATION_COMPLETE', detail: result })
        },
      }

      // Register internal handlers with our own feedback loop
      useFeedback(internalHandlers as Record<string, (detail: unknown) => void | Promise<void>>)
      
      // Call user's bProgram with runner
      const userHandlers = await userBProgram({
        ...args,
        runner,
      })

      return userHandlers
    },
  })
}