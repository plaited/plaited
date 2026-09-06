import * as z from 'zod'
import type { Thread } from '../main/behavioral.schemas.ts'
import { validateThread } from '../main/behavioral.schemas.ts'
import { verifyFrontiers } from '../main/frontier-analysis.ts'
import { useMCPServer } from './use-mcp-server.ts'

/**
 * `verify_frontiers` MCP tool.
 *
 * Wraps {@link verifyFrontiers} from `src/main/frontier-analysis.ts` so an agent
 * (the autoresearch loop) can ask "does this thread set deadlock or livelock?"
 * over the process edge and receive a verdict as structured JSON.
 *
 * The tool is verdict-only and policy-free: it returns `verified | failed |
 * truncated` plus the `report.truncated` flag. The caller maps those statuses
 * to its own selection policy — no reward scalar or retry gate is baked in here.
 *
 * Trust boundary: input is JSON over a process edge. Each `threads` entry is
 * validated with the existing AJV `validateThread` validator before the runtime
 * call. Invalid threads are returned as structured error output — never thrown.
 */

export const VERIFY_FRONTIERS_TOOL_NAME = 'verify_frontiers'

const VerifyFrontiersInputSchema = z
  .object({
    threads: z
      .array(
        z.object({
          label: z.string().describe('Human-readable thread label; appears in trace messages.'),
          once: z.literal(true).optional().describe('When true, the thread runs its rules once and completes.'),
          rules: z
            .array(z.unknown())
            .optional()
            .describe(
              'Thread synchronization statements (Idioms[]). Modeled as unknown[] here; ' +
                'the runtime verifyFrontiers call validates idioms internally.',
            ),
        }),
      )
      .describe('Thread tuples to analyze.'),
    maxDepth: z.number().int().positive().optional().describe('Maximum selection depth before truncating exploration.'),
    progress: z
      .array(z.string())
      .optional()
      .describe('Event types that count as progress; omit to skip livelock analysis.'),
    strategy: z.enum(['bfs', 'dfs']).optional().describe('Exploration strategy.'),
    selectionPolicy: z
      .enum(['all-enabled', 'scheduler'])
      .optional()
      .describe('How to select among enabled candidates.'),
    triggers: z
      .array(z.object({ type: z.string() }).passthrough())
      .optional()
      .describe('External trigger events that may wake pending threads.'),
    space: z.string().optional().describe('Space stamp applied to all thread rules.'),
  })
  .describe('Verify a behavioral thread set: explore frontiers and derive a verdict.')

const VerifyFrontiersOutputSchema = z
  .object({
    // ok is boolean (not literal(true)) so the error-path outputs (ok: false,
    // isError: true) also conform. The verdict fields are optional because
    // error outputs carry only message/isError — matching binary.ts's pattern
    // of one output schema covering both success and failure shapes.
    ok: z.boolean().describe('true on a successful verification call (verified, failed, or truncated).'),
    status: z
      .enum(['verified', 'failed', 'truncated'])
      .optional()
      .describe('Verdict: verified (no findings), failed (deadlock/livelock), truncated (maxDepth hit).'),
    findings: z.array(z.unknown()).optional().describe('Deadlock findings discovered during exploration.'),
    livelocks: z.array(z.unknown()).optional().describe('Livelock findings (reachable cycles with no progress event).'),
    report: z
      .object({
        strategy: z.enum(['bfs', 'dfs']),
        selectionPolicy: z.enum(['all-enabled', 'scheduler']),
        visitedCount: z.number().int(),
        findingCount: z.number().int(),
        truncated: z.boolean().describe('true when exploration hit maxDepth before exhausting the frontier.'),
        maxDepth: z.number().optional(),
      })
      .passthrough()
      .optional()
      .describe('Exploration report; surface report.truncated so the caller can retry with a higher maxDepth.'),
    message: z.string().optional().describe('error detail when isError'),
    isError: z.boolean().optional().describe('true when the operation failed — the message field explains why'),
    errors: z.unknown().optional().describe('AJV errors when a thread failed validateThread at the trust boundary'),
  })
  .describe('Verdict for a verify_frontiers call.')

export const verifyFrontiersTool = useMCPServer((server) => {
  server.registerTool(
    VERIFY_FRONTIERS_TOOL_NAME,
    {
      description:
        'Verify a behavioral thread set by exploring its frontiers and deriving a ' +
        'verified/failed/truncated verdict. Returns deadlock findings, livelock findings, ' +
        'and an exploration report (including a truncated flag for retry decisions). ' +
        'Verdict-only and policy-free: the caller maps the status to its own selection policy.',
      inputSchema: VerifyFrontiersInputSchema,
      outputSchema: VerifyFrontiersOutputSchema,
    },
    async (input) => {
      // Trust boundary: validate each thread entry with the existing AJV
      // validateThread validator. Invalid threads return structured error
      // output — never thrown.
      for (const thread of input.threads) {
        if (!validateThread(thread)) {
          const output = {
            ok: false as const,
            isError: true,
            message: 'invalid thread',
            errors: validateThread.errors,
          }
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(output) }],
            structuredContent: output,
          }
        }
      }

      try {
        // validateThread (AJV, using IdiomSchema) has already validated each
        // thread's structure above, so narrowing unknown[] rules to Idioms[]
        // here is justified post-validation.
        const threads = input.threads as Thread[]
        const verdict = verifyFrontiers({
          threads,
          maxDepth: input.maxDepth,
          progress: input.progress,
          strategy: input.strategy,
          selectionPolicy: input.selectionPolicy,
          triggers: input.triggers,
          space: input.space,
          messages: [],
        })
        const output = {
          ok: true as const,
          status: verdict.status,
          findings: verdict.findings,
          livelocks: verdict.livelocks,
          report: verdict.report,
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output) }],
          structuredContent: output,
        }
      } catch (err) {
        const output = {
          ok: false as const,
          isError: true,
          message: `[Error: verify_frontiers failed: ${(err as Error).message}]`,
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output) }],
          structuredContent: output,
        }
      }
    },
  )
})
