import * as z from 'zod'
import { PlaitedTraceSchema, TrialProcessSummarySchema } from '../eval/eval.schema.ts'
import { RESEARCH_EVENTS } from './research.constants.ts'

const ResearchJsonObjectSchema = z.record(z.string(), z.json())

export const ServeEventSchema = z.object({
  type: z.literal(RESEARCH_EVENTS.serve),
  detail: z.object({
    coder: z.boolean(),
    analyst: z.boolean(),
  }),
})

export type ServeEvent = z.output<typeof ServeEventSchema>

export const AnalystExecuteEventSchema = z.object({
  type: z.literal(RESEARCH_EVENTS.execute),
  detail: z.object({
    command: z.array(z.string()).min(1),
    cwd: z.string(),
    timeoutMs: z.number().int().positive().optional(),
    maxOutputBytes: z.number().int().positive().optional(),
  }),
})

export type AnalystExecuteEvent = z.output<typeof AnalystExecuteEventSchema>

export const ResearchRuntimeRoleSchema = z
  .enum(['analyst', 'coder'])
  .describe('Research runtime lane for the Gemma 4 analyst/coder vLLM servers.')

export type ResearchRuntimeRole = z.output<typeof ResearchRuntimeRoleSchema>

export const ResearchChatMessageSchema = z
  .object({
    role: z.enum(['system', 'user', 'assistant', 'tool']),
    content: z.string().min(1),
    toolCallId: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
  })
  .strict()
  .describe('Normalized chat message entry used to build a model request.')

export type ResearchChatMessage = z.output<typeof ResearchChatMessageSchema>

export const ResearchToolDefinitionSchema = z
  .object({
    type: z.literal('function'),
    function: z
      .object({
        name: z.string().min(1),
        description: z.string().min(1).optional(),
        parameters: ResearchJsonObjectSchema.optional(),
      })
      .strict(),
  })
  .strict()
  .describe('Tool declaration entry passed to the Gemma 4 chat-completions API.')

export type ResearchToolDefinition = z.output<typeof ResearchToolDefinitionSchema>

export const ResearchTaskEventSchema = z
  .object({
    type: z.literal(RESEARCH_EVENTS.task),
    detail: z
      .object({
        taskId: z.string().min(1),
        runtime: ResearchRuntimeRoleSchema,
        prompt: z.string().min(1),
        metadata: ResearchJsonObjectSchema.optional(),
      })
      .strict(),
  })
  .strict()
  .describe('Starts a research turn for one runtime lane.')

export type ResearchTaskEvent = z.output<typeof ResearchTaskEventSchema>

export const ResearchContextReadyEventSchema = z
  .object({
    type: z.literal(RESEARCH_EVENTS.context_ready),
    detail: z
      .object({
        taskId: z.string().min(1),
        runtime: ResearchRuntimeRoleSchema,
        messages: z.array(ResearchChatMessageSchema).min(1),
        tools: z.array(ResearchToolDefinitionSchema).optional(),
      })
      .strict(),
  })
  .strict()
  .describe('Publishes validated context for the active task before model execution.')

export type ResearchContextReadyEvent = z.output<typeof ResearchContextReadyEventSchema>

export const ResearchModelRequestEventSchema = z
  .object({
    type: z.literal(RESEARCH_EVENTS.model_request),
    detail: z
      .object({
        taskId: z.string().min(1),
        runtime: ResearchRuntimeRoleSchema,
        cause: z.enum(['initial', 'after_tool', 'retry']).default('initial'),
        model: z.string().min(1).optional(),
        temperature: z.number().min(0).max(2).optional(),
        maxCompletionTokens: z.number().int().positive().optional(),
      })
      .strict(),
  })
  .strict()
  .describe('Requests one model step from the active analyst/coder runtime.')

export type ResearchModelRequestEvent = z.output<typeof ResearchModelRequestEventSchema>

export const ResearchToolCallSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    arguments: z.string(),
  })
  .strict()
  .describe('Normalized tool call payload emitted by the model response handler.')

export type ResearchToolCall = z.output<typeof ResearchToolCallSchema>

export const ResearchModelResponseEventSchema = z
  .object({
    type: z.literal(RESEARCH_EVENTS.model_response),
    detail: z
      .object({
        taskId: z.string().min(1),
        runtime: ResearchRuntimeRoleSchema,
        content: z.string().min(1).optional(),
        finishReason: z.string().nullable().optional(),
        toolCalls: z.array(ResearchToolCallSchema).optional(),
      })
      .strict()
      .superRefine((value, ctx) => {
        if ((value.content?.length ?? 0) > 0) {
          return
        }
        if ((value.toolCalls?.length ?? 0) > 0) {
          return
        }
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'model_response must include content or at least one tool call.',
          path: ['content'],
        })
      }),
  })
  .strict()
  .describe('Normalized model output for one research turn step.')

export type ResearchModelResponseEvent = z.output<typeof ResearchModelResponseEventSchema>

export const ResearchToolIntentEventSchema = z
  .object({
    type: z.literal(RESEARCH_EVENTS.tool_intent),
    detail: z
      .object({
        taskId: z.string().min(1),
        runtime: ResearchRuntimeRoleSchema,
        toolCallId: z.string().min(1),
        toolName: z.string().min(1),
        arguments: z.string(),
      })
      .strict(),
  })
  .strict()
  .describe('Represents model-emitted intent to execute one tool call.')

export type ResearchToolIntentEvent = z.output<typeof ResearchToolIntentEventSchema>

export const ResearchToolResultEventSchema = z
  .object({
    type: z.literal(RESEARCH_EVENTS.tool_result),
    detail: z
      .object({
        taskId: z.string().min(1),
        runtime: ResearchRuntimeRoleSchema,
        toolCallId: z.string().min(1),
        toolName: z.string().min(1),
        ok: z.boolean(),
        result: ResearchJsonObjectSchema.optional(),
        error: z.string().min(1).optional(),
      })
      .strict()
      .superRefine((value, ctx) => {
        if (value.ok && value.result === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'tool_result with ok=true requires result.',
            path: ['result'],
          })
        }
        if (!value.ok && value.error === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'tool_result with ok=false requires error.',
            path: ['error'],
          })
        }
      }),
  })
  .strict()
  .describe('Carries execution outcome for a previously emitted tool intent.')

export type ResearchToolResultEvent = z.output<typeof ResearchToolResultEventSchema>

export const ResearchMessageEventSchema = z
  .object({
    type: z.literal(RESEARCH_EVENTS.message),
    detail: z
      .object({
        taskId: z.string().min(1),
        runtime: ResearchRuntimeRoleSchema,
        role: z.enum(['assistant', 'system', 'tool']),
        content: z.string().min(1),
        terminal: z.boolean().optional(),
      })
      .strict()
      .superRefine((value, ctx) => {
        if (!value.terminal) {
          return
        }
        if (value.role === 'assistant') {
          return
        }
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'terminal=true is only valid for assistant messages.',
          path: ['terminal'],
        })
      }),
  })
  .strict()
  .describe('Publishes normalized message output from the control loop.')

export type ResearchMessageEvent = z.output<typeof ResearchMessageEventSchema>

export const ResearchApprovalEventSchema = z
  .object({
    type: z.literal(RESEARCH_EVENTS.approval),
    detail: z
      .object({
        taskId: z.string().min(1),
        runtime: ResearchRuntimeRoleSchema,
        approved: z.boolean(),
        reason: z.string().min(1).optional(),
      })
      .strict(),
  })
  .strict()
  .describe('Captures approval decisions emitted or consumed by the research loop.')

export type ResearchApprovalEvent = z.output<typeof ResearchApprovalEventSchema>

export const ResearchContractViolationEventSchema = z
  .object({
    type: z.literal(RESEARCH_EVENTS.contract_violation),
    detail: z
      .object({
        eventType: z.string().min(1),
        reason: z.string().min(1),
        issues: z.array(z.string().min(1)).min(1),
        taskId: z.string().min(1).optional(),
        payload: ResearchJsonObjectSchema.optional(),
      })
      .strict(),
  })
  .strict()
  .describe('Observable diagnostic for invalid runtime-control payloads and protocol violations.')

export type ResearchContractViolationEvent = z.output<typeof ResearchContractViolationEventSchema>

export const ResearchControlEventSchema = z
  .discriminatedUnion('type', [
    ResearchTaskEventSchema,
    ResearchContextReadyEventSchema,
    ResearchModelRequestEventSchema,
    ResearchModelResponseEventSchema,
    ResearchToolIntentEventSchema,
    ResearchToolResultEventSchema,
    ResearchMessageEventSchema,
    ResearchApprovalEventSchema,
  ])
  .describe('Typed event contract for symbolic control of research model execution.')

export type ResearchControlEvent = z.output<typeof ResearchControlEventSchema>

export const ResearchVllmToolCallSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('function'),
    function: z
      .object({
        name: z.string().min(1),
        arguments: z.string(),
      })
      .strict(),
  })
  .strict()

export const ResearchVllmChatCompletionResponseSchema = z
  .object({
    choices: z
      .array(
        z
          .object({
            message: z
              .object({
                content: z.string().nullable().optional(),
                tool_calls: z.array(ResearchVllmToolCallSchema).optional(),
              })
              .passthrough(),
            finish_reason: z.string().nullable().optional(),
          })
          .passthrough(),
      )
      .min(1),
  })
  .passthrough()

export const ResearchPromptInputSchema = z
  .union([z.string(), z.array(z.string())])
  .describe('Single-turn prompt or ordered multi-turn prompts.')

export type ResearchPromptInput = z.output<typeof ResearchPromptInputSchema>

export const ResearchTrialEntrySchema = z
  .object({
    trialNum: z.number().int().positive().describe('Trial number (1-indexed).'),
    output: z.string().describe('Final model output for this trial.'),
    duration: z.number().nonnegative().describe('Runner-observed trial duration in milliseconds.'),
    pass: z.boolean().optional().describe('Optional pass/fail outcome from grading.'),
    score: z.number().min(0).max(1).optional().describe('Optional normalized grader score in [0, 1].'),
    reasoning: z.string().optional().describe('Optional grader reasoning text.'),
    trace: PlaitedTraceSchema.optional().describe('Optional trace captured for this trial.'),
    process: TrialProcessSummarySchema.optional().describe('Optional post-run process summary for this trial.'),
    metadata: z.record(z.string(), z.unknown()).optional().describe('Optional per-trial metadata.'),
  })
  .describe('One research trial entry.')

export type ResearchTrialEntry = z.output<typeof ResearchTrialEntrySchema>

export const ResearchPromptResultSchema = z
  .object({
    id: z.string().describe('Prompt-case identifier.'),
    input: ResearchPromptInputSchema.describe('Prompt payload used for this case.'),
    trials: z
      .array(ResearchTrialEntrySchema)
      .min(1)
      .describe('Trial rows for this prompt case. `trials[].pass` is canonical pass/fail evidence when present.'),
    k: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Optional prompt-level sample width; when set it must equal `trials.length`.'),
    passRate: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe(
        'Optional cached pass-rate aggregate; comparison normalizes from `trials[].pass` when evidence exists.',
      ),
    passAtK: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('Optional cached pass@k aggregate; comparison normalizes from `trials[].pass` when evidence exists.'),
    passExpK: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe(
        'Optional cached expected pass@k aggregate; comparison normalizes from `trials[].pass` when evidence exists.',
      ),
    metadata: z.record(z.string(), z.unknown()).optional().describe('Optional prompt-level metadata.'),
  })
  .superRefine((value, ctx) => {
    if (value.k === undefined) {
      return
    }
    if (value.k !== value.trials.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['k'],
        message: 'k must equal trials.length when provided.',
      })
    }
  })
  .describe('Research run result for one prompt case.')

export type ResearchPromptResult = z.output<typeof ResearchPromptResultSchema>

export const ResearchRunSchema = z
  .object({
    label: z.string().describe('Display label for this run (for example baseline/challenger).'),
    results: z.array(ResearchPromptResultSchema).describe('Prompt results contained in this run.'),
  })
  .describe('Research run bundle used for comparisons and promotion decisions.')

export type ResearchRun = z.output<typeof ResearchRunSchema>

export const ResearchRunMetricsSchema = z
  .object({
    label: z.string().describe('Run label shown in reports and summary output.'),
    promptCount: z.number().int().nonnegative().describe('Number of prompt IDs represented in this run.'),
    comparablePromptCount: z
      .number()
      .int()
      .nonnegative()
      .describe('Number of prompts with full trial pass/fail coverage used for pass metrics.'),
    avgPassRate: z.number().describe('Mean pass rate across prompts.'),
    avgPassAtK: z.number().describe('Mean pass@k across prompts.'),
    avgDuration: z.number().describe('Average trial duration in milliseconds.'),
    medianDuration: z.number().describe('Median trial duration in milliseconds.'),
    passRateCI: z.tuple([z.number(), z.number()]).describe('Confidence interval for average pass rate [low, high].'),
    passAtKCI: z.tuple([z.number(), z.number()]).describe('Confidence interval for average pass@k [low, high].'),
  })
  .describe('Aggregate metrics for one research run.')

export type ResearchRunMetrics = z.output<typeof ResearchRunMetricsSchema>

export const ResearchPromptWinnerSchema = z
  .enum(['baseline', 'challenger', 'tie', 'insufficient_data'])
  .describe('Winner classification for one prompt-level comparison row.')

export type ResearchPromptWinner = z.output<typeof ResearchPromptWinnerSchema>

export const ResearchPromptComparisonSchema = z
  .object({
    id: z.string().describe('Prompt identifier shared between baseline and challenger rows.'),
    baselinePassRate: z.number().nullable().describe('Baseline pass rate for this prompt, or null when unavailable.'),
    challengerPassRate: z
      .number()
      .nullable()
      .describe('Challenger pass rate for this prompt, or null when unavailable.'),
    baselinePassAtK: z.number().nullable().describe('Baseline pass@k for this prompt, or null when unavailable.'),
    challengerPassAtK: z.number().nullable().describe('Challenger pass@k for this prompt, or null when unavailable.'),
    winner: ResearchPromptWinnerSchema.describe('Prompt-level winner classification.'),
  })
  .describe('Head-to-head comparison row for one prompt.')

export type ResearchPromptComparison = z.output<typeof ResearchPromptComparisonSchema>

export const ResearchRunComparisonSummarySchema = z
  .object({
    baselineWins: z.number().int().nonnegative().describe('Count of prompts won by the baseline run.'),
    challengerWins: z.number().int().nonnegative().describe('Count of prompts won by the challenger run.'),
    ties: z.number().int().nonnegative().describe('Count of prompts with tied outcome.'),
    insufficientData: z.number().int().nonnegative().describe('Count of prompts missing comparable scoring evidence.'),
    totalPrompts: z.number().int().nonnegative().describe('Total prompt IDs considered in the comparison.'),
  })
  .describe('Outcome counts for a research run comparison.')

export type ResearchRunComparisonSummary = z.output<typeof ResearchRunComparisonSummarySchema>

export const ResearchRunComparisonSchema = z
  .object({
    baseline: ResearchRunMetricsSchema.describe('Aggregate metrics for the baseline run.'),
    challenger: ResearchRunMetricsSchema.describe('Aggregate metrics for the challenger run.'),
    perPrompt: z.array(ResearchPromptComparisonSchema).describe('Per-prompt comparison rows.'),
    summary: ResearchRunComparisonSummarySchema.describe('Top-level comparison summary counts.'),
  })
  .describe('Comparison output used for promotion decisions.')

export type ResearchRunComparison = z.output<typeof ResearchRunComparisonSchema>

export const ResearchPromotionDecisionSchema = z
  .object({
    decision: z
      .enum(['promote_challenger', 'keep_baseline'])
      .describe('Promotion action selected from comparison evidence.'),
    winner: z.enum(['baseline', 'challenger']).describe('Winning run under selection policy.'),
    reason: z.string().describe('Human-readable reason describing the decision outcome.'),
    winDelta: z.number().int().describe('Prompt-level win delta (challengerWins - baselineWins).'),
    passRateDelta: z.number().describe('Difference in average pass rate (challenger - baseline).'),
    passAtKDelta: z.number().describe('Difference in average pass@k (challenger - baseline).'),
  })
  .describe('Promotion decision derived from run comparison metrics.')

export type ResearchPromotionDecision = z.output<typeof ResearchPromotionDecisionSchema>

export const ResearchGradingDimensionsSchema = z
  .object({
    outcome: z.number().min(0).max(1).optional().describe('Outcome correctness score in [0, 1].'),
    process: z.number().min(0).max(1).optional().describe('Process quality score in [0, 1].'),
    efficiency: z.number().min(0).max(1).optional().describe('Efficiency score in [0, 1].'),
  })
  .describe('Optional multi-dimensional grader scoring breakdown.')

export type ResearchGradingDimensions = z.output<typeof ResearchGradingDimensionsSchema>

export const ResearchGraderInputSchema = z
  .object({
    input: ResearchPromptInputSchema.describe('Prompt payload used for the trial.'),
    output: z.string().describe('Final model output to grade.'),
    hint: z.string().optional().describe('Optional grading hint from prompt metadata.'),
    trace: PlaitedTraceSchema.optional().describe('Optional runtime trace captured for this trial.'),
    process: TrialProcessSummarySchema.optional().describe('Optional process summary derived from the trace.'),
    metadata: z.record(z.string(), z.unknown()).optional().describe('Optional grading metadata.'),
  })
  .describe('Input contract for research-run grading invocation.')

export type ResearchGraderInput = z.output<typeof ResearchGraderInputSchema>

export const ResearchGraderResultSchema = z
  .object({
    pass: z.boolean().describe('Pass/fail outcome from the grader.'),
    score: z.number().min(0).max(1).describe('Overall grader score in [0, 1].'),
    reasoning: z.string().optional().describe('Optional explanation for pass/score results.'),
    outcome: z.record(z.string(), z.unknown()).optional().describe('Optional structured grader output payload.'),
    dimensions: ResearchGradingDimensionsSchema.optional().describe('Optional outcome/process/efficiency breakdown.'),
  })
  .describe('Normalized grading output for research-run utilities.')

export type ResearchGraderResult = z.output<typeof ResearchGraderResultSchema>

export type ResearchGrader = (input: ResearchGraderInput) => Promise<ResearchGraderResult>
