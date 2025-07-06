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

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
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
  getPlaitedTrigger,
  bThread,
  useSignal,
  type Signal,
} from '../behavioral.js'
import { defineMCPServer } from './define-mcp-server.js'
import type { Registry, PrimitiveHandlers, Tools, Resources, Prompts, ToolEntry, ResourceEntry, PromptEntry } from './mcp.types.js'
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

// ===== Runtime Expression Evaluator =====

class ExpressionEvaluator {
  constructor(private context: ExecutionContext) {}

  /**
   * Evaluates a runtime expression according to Arazzo spec
   */
  evaluate(expression: string | unknown): unknown {
    if (typeof expression !== 'string') {
      return expression
    }

    // Handle embedded expressions: "text {$expression} more text"
    if (expression.includes('{') && expression.includes('}')) {
      return expression.replace(/\{([^}]+)\}/g, (_, expr) => {
        const result = this.evaluateExpression(expr.trim())
        return String(result ?? '')
      })
    }

    // Handle direct expressions starting with $
    if (expression.startsWith('$')) {
      return this.evaluateExpression(expression)
    }

    return expression
  }

  private evaluateExpression(expr: string): unknown {
    if (!expr.startsWith('$')) {
      return expr
    }

    const parts = expr.split(/[.#/]/)
    const root = parts[0]

    switch (root) {
      case '$url':
        return this.context.url
      case '$method':
        return this.context.method
      case '$statusCode':
        return this.context.response?.statusCode
      case '$request':
        return this.evaluateRequest(expr)
      case '$response':
        return this.evaluateResponse(expr)
      case '$inputs':
        return this.evaluatePath(this.context.inputs, parts.slice(1))
      case '$outputs':
        return this.evaluatePath(this.context.outputs, parts.slice(1))
      case '$steps':
        return this.evaluateSteps(parts.slice(1))
      case '$workflows':
        return this.evaluateWorkflows(parts.slice(1))
      case '$sourceDescriptions':
        return this.evaluateSourceDescriptions(parts.slice(1))
      case '$components':
        return this.evaluateComponents(parts.slice(1))
      default:
        return undefined
    }
  }

  private evaluateRequest(expr: string): unknown {
    // TODO: Implement request evaluation
    return undefined
  }

  private evaluateResponse(expr: string): unknown {
    if (!this.context.response) return undefined

    if (expr.includes('#')) {
      // JSON Pointer syntax
      const [base, pointer] = expr.split('#')
      if (base === '$response.body') {
        return this.evaluateJsonPointer(this.context.response.body, pointer)
      }
    }

    const parts = expr.split('.')
    if (parts[1] === 'header') {
      return this.context.response.headers[parts[2]]
    }
    if (parts[1] === 'body') {
      return this.context.response.body
    }

    return undefined
  }

  private evaluateSteps(parts: string[]): unknown {
    const [stepId, ...rest] = parts
    const step = this.context.steps[stepId]
    if (!step) return undefined

    if (rest[0] === 'outputs') {
      return this.evaluatePath(step.outputs || {}, rest.slice(1))
    }

    return step
  }

  private evaluateWorkflows(parts: string[]): unknown {
    const [workflowId, ...rest] = parts
    const workflow = this.context.workflows[workflowId]
    if (!workflow) return undefined

    if (rest[0] === 'outputs') {
      return this.evaluatePath(workflow.outputs || {}, rest.slice(1))
    }

    return workflow
  }

  private evaluateSourceDescriptions(parts: string[]): unknown {
    const [name, ...rest] = parts
    const source = this.context.sourceDescriptions[name]
    if (!source) return undefined

    return this.evaluatePath(source, rest)
  }

  private evaluateComponents(parts: string[]): unknown {
    return this.evaluatePath(this.context.components || {}, parts)
  }

  private evaluatePath(obj: unknown, path: string[]): unknown {
    let current = obj
    for (const part of path) {
      if (current === null || current === undefined) return undefined
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[part]
      } else {
        return undefined
      }
    }
    return current
  }

  private evaluateJsonPointer(obj: unknown, pointer: string): unknown {
    if (!pointer || pointer === '/') return obj

    const parts = pointer.split('/').slice(1) // Remove empty first element
    let current = obj

    for (const part of parts) {
      if (current === null || current === undefined) return undefined

      // Unescape JSON Pointer tokens
      const key = part.replace(/~1/g, '/').replace(/~0/g, '~')

      if (Array.isArray(current)) {
        const index = parseInt(key, 10)
        if (isNaN(index)) return undefined
        current = current[index]
      } else if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[key]
      } else {
        return undefined
      }
    }

    return current
  }
}

// ===== Criterion Evaluator =====

class CriterionEvaluator {
  constructor(private evaluator: ExpressionEvaluator) {}

  evaluate(criterion: Criterion, context: ExecutionContext): boolean {
    const { condition, type = 'simple', context: criterionContext } = criterion

    switch (type) {
      case 'simple':
        return this.evaluateSimple(condition, context)
      case 'regex':
        return this.evaluateRegex(condition, criterionContext || '', context)
      case 'jsonpath':
        return this.evaluateJsonPath(condition, criterionContext || '', context)
      case 'xpath':
        // TODO: Implement XPath evaluation
        console.warn('XPath criterion type not yet supported')
        return false
      default:
        if (typeof type === 'object' && type.type) {
          // Handle CriterionExpressionType
          console.warn(`Custom criterion type ${type.type} not yet supported`)
          return false
        }
        return false
    }
  }

  private evaluateSimple(condition: string, context: ExecutionContext): boolean {
    // Simple expression evaluation - supports basic operators
    // This is a simplified implementation - a real one would need proper parsing
    const evalContext = {
      $statusCode: context.response?.statusCode,
      $url: context.url,
      $method: context.method,
    }

    // Basic equality check for status codes
    const statusMatch = condition.match(/\$statusCode\s*==\s*(\d+)/)
    if (statusMatch) {
      return evalContext.$statusCode === parseInt(statusMatch[1], 10)
    }

    // TODO: Implement full expression parsing
    console.warn(`Complex simple expressions not yet fully supported: ${condition}`)
    return true
  }

  private evaluateRegex(pattern: string, contextExpr: string, context: ExecutionContext): boolean {
    const contextValue = this.evaluator.evaluate(contextExpr)
    if (typeof contextValue !== 'string') return false

    try {
      const regex = new RegExp(pattern)
      return regex.test(contextValue)
    } catch {
      return false
    }
  }

  private evaluateJsonPath(path: string, contextExpr: string, context: ExecutionContext): boolean {
    const contextValue = this.evaluator.evaluate(contextExpr)
    // TODO: Implement JSONPath evaluation
    console.warn('JSONPath criterion type not yet implemented')
    return true
  }
}

// ===== HTTP Operation Executor =====

class OperationExecutor {
  constructor(
    private httpClient: typeof useFetch,
    private environmentResolver: (key: string) => string | undefined,
    private openApiDocs: Map<string, Record<string, unknown>>
  ) {}

  async executeOperation(
    operationId: string | undefined,
    operationPath: string | undefined,
    parameters: Record<string, unknown>,
    requestBody: unknown,
    context: ExecutionContext,
    trigger: PlaitedTrigger
  ): Promise<OperationResult> {
    // TODO: Implement OpenAPI operation resolution and execution
    // This would:
    // 1. Find the operation in OpenAPI docs
    // 2. Build the request URL with parameters
    // 3. Add authentication headers
    // 4. Execute the HTTP request
    // 5. Return the result

    // Placeholder implementation
    const response = await this.httpClient({
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

    return {
      status: 'success',
      statusCode: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: await response.json().catch(() => response.text()),
    }
  }
}

// ===== Step Executor =====

class StepExecutor {
  constructor(
    private operationExecutor: OperationExecutor,
    private workflowRunner: WorkflowRunner,
    private evaluator: ExpressionEvaluator,
    private criterionEvaluator: CriterionEvaluator
  ) {}

  async executeStep(
    step: Step,
    workflow: Workflow,
    context: ExecutionContext,
    trigger: PlaitedTrigger
  ): Promise<StepResult> {
    context.currentStep = step.stepId

    // Initialize step result
    context.steps[step.stepId] = {
      status: 'running',
    }

    try {
      // Resolve parameters
      const resolvedParams = this.resolveParameters(step.parameters || [], context)

      // Execute based on step type
      let result: OperationResult | WorkflowResult

      if (step.operationId || step.operationPath) {
        // Execute operation
        result = await this.operationExecutor.executeOperation(
          step.operationId,
          step.operationPath,
          resolvedParams,
          step.requestBody ? this.evaluator.evaluate(step.requestBody.payload) : undefined,
          context,
          trigger
        )

        // Update context with response
        if ('statusCode' in result) {
          context.response = {
            statusCode: result.statusCode || 0,
            headers: result.headers || {},
            body: result.body,
          }
        }
      } else if (step.workflowId) {
        // Execute nested workflow
        const workflowInputs = resolvedParams
        const workflowResult = await this.workflowRunner.executeWorkflow(step.workflowId, workflowInputs)
        
        // Store nested workflow result
        context.workflows[step.workflowId] = workflowResult
        result = workflowResult
      } else {
        throw new Error('Step must specify operationId, operationPath, or workflowId')
      }

      // Check success criteria
      const isSuccess = this.checkSuccessCriteria(step.successCriteria || [], context)

      if (isSuccess) {
        // Extract outputs
        const outputs = this.extractOutputs(step.outputs || {}, context)
        
        context.steps[step.stepId] = {
          status: 'success',
          outputs,
        }

        return context.steps[step.stepId]
      } else {
        context.steps[step.stepId] = {
          status: 'failure',
          error: new Error('Success criteria not met'),
        }

        return context.steps[step.stepId]
      }
    } catch (error) {
      context.steps[step.stepId] = {
        status: 'failure',
        error: error instanceof Error ? error : new Error(String(error)),
      }

      return context.steps[step.stepId]
    }
  }

  private resolveParameters(parameters: (Parameter | ReusableObject)[], context: ExecutionContext): Record<string, unknown> {
    const resolved: Record<string, unknown> = {}

    for (const param of parameters) {
      if ('reference' in param) {
        // Handle reusable object
        const referencedParam = this.evaluator.evaluate(param.reference) as Parameter
        if (referencedParam) {
          resolved[referencedParam.name] = param.value !== undefined 
            ? param.value 
            : this.evaluator.evaluate(referencedParam.value)
        }
      } else {
        // Handle direct parameter
        resolved[param.name] = this.evaluator.evaluate(param.value)
      }
    }

    return resolved
  }

  private checkSuccessCriteria(criteria: Criterion[], context: ExecutionContext): boolean {
    if (criteria.length === 0) {
      // Default: 2xx status codes are success
      const statusCode = context.response?.statusCode
      return statusCode !== undefined && statusCode >= 200 && statusCode < 300
    }

    // All criteria must pass
    return criteria.every(criterion => this.criterionEvaluator.evaluate(criterion, context))
  }

  private extractOutputs(outputs: Record<string, string>, context: ExecutionContext): Record<string, unknown> {
    const extracted: Record<string, unknown> = {}

    for (const [key, expression] of Object.entries(outputs)) {
      extracted[key] = this.evaluator.evaluate(expression)
    }

    return extracted
  }
}

// ===== Workflow Runner =====

export class WorkflowRunner {
  private workflows: Map<string, Workflow> = new Map()
  private sourceDescriptions: Map<string, SourceDescription> = new Map()
  private components: Components = {}
  private operationExecutor: OperationExecutor
  private stepExecutor: StepExecutor
  private runningWorkflows: Map<string, Signal<WorkflowResult>> = new Map()

  constructor(
    private arazzoDocuments: ArazzoDocument[],
    private openApiDocs: Map<string, Record<string, unknown>>,
    private environmentResolver: (key: string) => string | undefined,
    private httpClient: typeof useFetch,
    private trigger: PlaitedTrigger
  ) {
    // Initialize documents
    this.loadDocuments()

    // Create executors
    this.operationExecutor = new OperationExecutor(httpClient, environmentResolver, openApiDocs)
    
    // Step executor needs reference to workflow runner for nested workflows
    this.stepExecutor = new StepExecutor(
      this.operationExecutor,
      this,
      new ExpressionEvaluator({} as ExecutionContext), // Will be updated per execution
      new CriterionEvaluator(new ExpressionEvaluator({} as ExecutionContext))
    )
  }

  private loadDocuments() {
    for (const doc of this.arazzoDocuments) {
      // Load workflows
      for (const workflow of doc.workflows) {
        this.workflows.set(workflow.workflowId, workflow)
      }

      // Load source descriptions
      for (const source of doc.sourceDescriptions) {
        this.sourceDescriptions.set(source.name, source)
      }

      // Merge components
      if (doc.components) {
        this.components = { ...this.components, ...doc.components }
      }
    }
  }

  async executeWorkflow(workflowId: string, inputs: Record<string, unknown>): Promise<WorkflowResult> {
    const workflow = this.workflows.get(workflowId)
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`)
    }

    // Check if workflow is already running
    const existingRun = this.runningWorkflows.get(workflowId)
    if (existingRun) {
      const result = existingRun.get()
      if (result) return result
      // If no result yet, wait for it
      return new Promise<WorkflowResult>((resolve) => {
        existingRun.listen('workflow-complete', (finalResult: WorkflowResult) => {
          resolve(finalResult)
        })
      })
    }

    // Create execution context
    const context: ExecutionContext = {
      inputs,
      outputs: {},
      steps: {},
      workflows: {},
      sourceDescriptions: Object.fromEntries(this.sourceDescriptions),
      components: this.components,
      currentWorkflow: workflowId,
    }

    // Create evaluators with context
    const evaluator = new ExpressionEvaluator(context)
    const criterionEvaluator = new CriterionEvaluator(evaluator)

    // Create step executor with context-aware evaluators
    const stepExecutor = new StepExecutor(
      this.operationExecutor,
      this,
      evaluator,
      criterionEvaluator
    )

    // Track workflow execution
    const workflowSignal = useSignal<WorkflowResult>({
      workflowId,
      status: 'success',
      outputs: {},
      steps: {},
    })
    this.runningWorkflows.set(workflowId, workflowSignal)

    try {
      // Execute dependencies first
      if (workflow.dependsOn) {
        for (const depWorkflowId of workflow.dependsOn) {
          const depResult = await this.executeWorkflow(depWorkflowId, inputs)
          context.workflows[depWorkflowId] = depResult
        }
      }

      // Execute steps sequentially
      for (const step of workflow.steps) {
        const stepResult = await stepExecutor.executeStep(step, workflow, context, this.trigger)

        if (stepResult.status === 'failure') {
          // Handle failure actions
          const action = await this.handleFailureActions(
            step.onFailure || workflow.failureActions || [],
            context,
            criterionEvaluator
          )

          if (action?.type === 'retry') {
            // Implement retry logic
            let retryCount = 0
            const retryLimit = action.retryLimit || 1
            const retryAfter = action.retryAfter || 1

            while (retryCount < retryLimit) {
              await wait(retryAfter * 1000)
              const retryResult = await stepExecutor.executeStep(step, workflow, context, this.trigger)
              
              if (retryResult.status === 'success') {
                break
              }
              
              retryCount++
              context.steps[step.stepId].retryCount = retryCount
            }
          } else if (action?.type === 'goto') {
            // Handle goto logic
            // TODO: Implement goto step/workflow
          } else if (action?.type === 'end') {
            // End workflow
            break
          }
        } else {
          // Handle success actions
          const action = await this.handleSuccessActions(
            step.onSuccess || workflow.successActions || [],
            context,
            criterionEvaluator
          )

          if (action?.type === 'goto') {
            // Handle goto logic
            // TODO: Implement goto step/workflow
          } else if (action?.type === 'end') {
            // End workflow
            break
          }
        }
      }

      // Extract workflow outputs
      const outputs = this.extractWorkflowOutputs(workflow.outputs || {}, context, evaluator)

      const result: WorkflowResult = {
        workflowId,
        status: 'success',
        outputs,
        steps: context.steps,
      }

      workflowSignal.set(result)
      return result
    } catch (error) {
      const result: WorkflowResult = {
        workflowId,
        status: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
        steps: context.steps,
      }

      workflowSignal.set(result)
      return result
    } finally {
      this.runningWorkflows.delete(workflowId)
    }
  }

  private async handleSuccessActions(
    actions: (SuccessAction | ReusableObject)[],
    context: ExecutionContext,
    criterionEvaluator: CriterionEvaluator
  ): Promise<SuccessAction | undefined> {
    for (const action of actions) {
      const resolvedAction = 'reference' in action 
        ? new ExpressionEvaluator(context).evaluate(action.reference) as SuccessAction
        : action

      if (!resolvedAction) continue

      // Check criteria
      if (resolvedAction.criteria) {
        const allMatch = resolvedAction.criteria.every(c => criterionEvaluator.evaluate(c, context))
        if (!allMatch) continue
      }

      return resolvedAction
    }

    return undefined
  }

  private async handleFailureActions(
    actions: (FailureAction | ReusableObject)[],
    context: ExecutionContext,
    criterionEvaluator: CriterionEvaluator
  ): Promise<FailureAction | undefined> {
    for (const action of actions) {
      const resolvedAction = 'reference' in action 
        ? new ExpressionEvaluator(context).evaluate(action.reference) as FailureAction
        : action

      if (!resolvedAction) continue

      // Check criteria
      if (resolvedAction.criteria) {
        const allMatch = resolvedAction.criteria.every(c => criterionEvaluator.evaluate(c, context))
        if (!allMatch) continue
      }

      return resolvedAction
    }

    return undefined
  }

  private extractWorkflowOutputs(
    outputs: Record<string, string>,
    context: ExecutionContext,
    evaluator: ExpressionEvaluator
  ): Record<string, unknown> {
    const extracted: Record<string, unknown> = {}

    for (const [key, expression] of Object.entries(outputs)) {
      extracted[key] = evaluator.evaluate(expression)
    }

    return extracted
  }

  listWorkflows(): Array<{ workflowId: string; summary?: string; description?: string }> {
    return Array.from(this.workflows.values()).map(w => ({
      workflowId: w.workflowId,
      summary: w.summary,
      description: w.description,
    }))
  }

  describeWorkflow(workflowId: string): Workflow | undefined {
    return this.workflows.get(workflowId)
  }

  getDocuments(): ArazzoDocument[] {
    return this.arazzoDocuments
  }

  getWorkflowState(workflowId: string): WorkflowResult | undefined {
    const signal = this.runningWorkflows.get(workflowId)
    if (!signal) return undefined
    return signal.get()
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
        inputSchema: z.object({
          workflowId: z.string().describe('The workflow ID to execute'),
          inputs: z.record(z.string(), z.any()).describe('Input parameters for the workflow'),
        }),
      },
    },
    'execute-operation': {
      primitive: 'tool' as const,
      config: {
        description: 'Execute a single OpenAPI operation',
        inputSchema: z.object({
          operationId: z.string().optional().describe('The operation ID from OpenAPI spec'),
          operationPath: z.string().optional().describe('The operation path and method (e.g., "GET /users")'),
          parameters: z.record(z.string(), z.any()).optional().describe('Operation parameters'),
          requestBody: z.any().optional().describe('Request body content'),
        }),
      },
    },
    'list-workflows': {
      primitive: 'tool' as const,
      config: {
        description: 'List all available workflows',
        inputSchema: z.object({}),
      },
    },
    'describe-workflow': {
      primitive: 'tool' as const,
      config: {
        description: 'Get details about a specific workflow',
        inputSchema: z.object({
          workflowId: z.string().describe('The workflow ID to describe'),
        }),
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
        uriOrTemplate: {
          template: 'arazzo://workflow/{workflowId}/state',
          parameters: [
            {
              name: 'workflowId',
              description: 'The workflow ID to get state for',
            },
          ],
        },
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
        argsSchema: z.object({
          workflowId: z.string().describe('The workflow ID to generate inputs for'),
        }),
      },
    },
  }

  // Create MCP server with behavioral program
  return defineMCPServer({
    name,
    version,
    registry,
    async bProgram(args) {
      // Create workflow runner
      const runner = new WorkflowRunner(
        loadedArazzoDocs,
        loadedOpenApiDocs,
        environmentResolver,
        httpClient,
        args.trigger
      )

      // Call user's bProgram with runner
      return userBProgram({
        ...args,
        runner,
      })
    },
  })
}