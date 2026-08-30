import type { OpenResponsesRequest, OpenResponsesStreamEvent } from './open-responses.schemas.ts'

/**
 * The contract for an Open Responses provider adapter.
 *
 * Accepts a validated request and returns an async-iterable stream of events.
 * **Never throws or rejects** for request/model/runtime failures — encode
 * failure as a terminal `response.failed` event.
 *
 * Abort is the caller's signal, passed via the request; the adapter honors it
 * if present (via `AbortSignal` in the request options or similar).
 *
 * @param req - A validated Open Responses request (parsed by the daemon before
 *   this function is called).
 * @returns An async-iterable of stream events, or a promise thereof.
 */
export type UseResponse = (
  req: OpenResponsesRequest,
) => AsyncIterable<OpenResponsesStreamEvent> | Promise<AsyncIterable<OpenResponsesStreamEvent>>

/**
 * Result of a compaction operation — returned by the adapter's compact function.
 * Matches the Open Responses spec's /v1/responses/compact response shape.
 */
export type CompactionResult = {
  readonly type: 'compaction'
  readonly encrypted_content: string
}

/**
 * A frozen adapter descriptor pairing a provider name with its respond function.
 *
 * The daemon routes model traffic by `provider` name; there is no registry in
 * Phase 0. Adapter modules (real or double) wire through `useResponse` for
 * their default export.
 *
 * @property contextWindow - Optional model context limit in tokens. When present,
 *   the agent loop compares terminal event `usage.input_tokens` against this value
 *   to trigger compaction.
 * @property compact - Optional spec-native compaction function. When absent,
 *   the agent loop synthesizes a compaction item via an internal summary.
 *   The function receives the request that triggered the compaction and returns
 *   a {@link CompactionResult} that becomes the base input for the next request.
 */
export type Adapter = {
  readonly provider: string
  readonly respond: UseResponse
  readonly contextWindow?: number
  readonly compact?: (req: OpenResponsesRequest) => Promise<CompactionResult>
}

/**
 * Create a frozen adapter descriptor.
 *
 * Validates that `provider` is a non-empty string and freezes the result.
 * Adapter lifecycle hooks (connect, disconnect, health) are a future upgrade
 * path — for now this is intentionally a one-line seam.
 *
 * @param opts.provider - The provider identifier used for daemon routing.
 * @param opts.respond - The respond function implementing the {@link UseResponse} contract.
 * @param opts.contextWindow - Optional model context limit in tokens.
 * @param opts.compact - Optional compaction function.
 * @returns A frozen {@link Adapter} descriptor.
 */
export const useResponse = ({
  provider,
  respond,
  contextWindow,
  compact,
}: {
  provider: string
  respond: UseResponse
  contextWindow?: number
  compact?: (req: OpenResponsesRequest) => Promise<CompactionResult>
}): Adapter => {
  if (typeof provider !== 'string' || provider.trim().length === 0) {
    throw new Error('provider must be a non-empty string')
  }
  // MINIMAL: one-line wrapper without lifecycle hooks. Upgrade path: add
  // connect/disconnect/health callbacks to the opts bag before freezing.
  return Object.freeze(
    compact !== undefined || contextWindow !== undefined
      ? {
          provider,
          respond,
          ...(contextWindow !== undefined && { contextWindow }),
          ...(compact !== undefined && { compact }),
        }
      : { provider, respond },
  )
}
