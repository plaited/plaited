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
 * A frozen adapter descriptor pairing a provider name with its respond function.
 *
 * The daemon routes model traffic by `provider` name; there is no registry in
 * Phase 0. Adapter modules (real or double) wire through `useResponse` for
 * their default export.
 */
export type Adapter = {
  readonly provider: string
  readonly respond: UseResponse
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
 * @returns A frozen {@link Adapter} descriptor.
 */
export const useResponse = ({ provider, respond }: { provider: string; respond: UseResponse }): Adapter => {
  if (typeof provider !== 'string' || provider.trim().length === 0) {
    throw new Error('provider must be a non-empty string')
  }
  // MINIMAL: one-line wrapper without lifecycle hooks. Upgrade path: add
  // connect/disconnect/health callbacks to the opts bag before freezing.
  return Object.freeze({ provider, respond })
}
