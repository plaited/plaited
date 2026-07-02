import {
  type Behavioral,
  type BPEvent,
  sync as baseSync,
  ensureArray,
  IDIOMS,
  type Idioms,
  type Sync,
  type Thread,
  thread,
} from '../behavioral.ts'
import { B_PROGRAM_IDENTIFIER } from './behavioral.constants.ts'

/**
 * Arguments supplied by the operator when initializing a page program.
 *
 * @remarks
 * `page` is the engine's own namespace field (formerly `topic`) — injected
 * directly into triggered events and sync listeners with no remap layer.
 * `route` is carried for context only (e.g. a URL pattern such as
 * `"/users/:id"`); the engine and matching never consult it. URL-param
 * extraction stays in the host route handler, not here.
 */
type InitArgs = Omit<ReturnType<Behavioral>, 'useSnapshot'> & {
  page: string
  route?: string
  cwd: string
  workflow: string
}

/**
 * Resolves a pending trigger promise identified by its correlation id.
 *
 * @remarks
 * Host route handlers receive this via the bProgram callback and call it with
 * the result of the behavioral work, unblocking the awaiting `trigger` call.
 */
type Resolve = (correlationId: string, result: unknown) => void

/**
 * Arguments passed to the page's `bProgram` callback.
 *
 * @remarks
 * The engine's raw `trigger` (void-returning) is replaced by a Promise-backed
 * trigger; a `resolve` bridge is added so handlers can fulfill those promises.
 */
type DefinePageArgs = Omit<ReturnType<Behavioral>, 'useSnapshot' | 'trigger'> & {
  sync: Sync
  thread: Thread
  trigger: <T = unknown>(event: BPEvent) => Promise<T>
  resolve: Resolve
}

type BProgram = (args: DefinePageArgs) => void | Promise<void>

type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
}

/** A registered thread captured by {@link definePage} extraction. */
type ThreadEntry = [string, ReturnType<Thread>]

export type DefinePage = (bProgram: BProgram) => {
  (args: InitArgs): Promise<void>
  $: typeof B_PROGRAM_IDENTIFIER
  /** Async extraction of statically-registered threads for frontier analysis. */
  extractThreads: () => Promise<ThreadEntry[]>
}

/**
 * Defines a page program: a behavioral program bound to a web route.
 *
 * @remarks
 * The behavioral engine (`behavioral.ts`) stays unaware of routes, promises,
 * or the web. `page` is the engine's own namespace field — no remap layer. All
 * web binding (Promise bridge, `resolve`, route param) lives here.
 *
 * The wrapped `trigger` returns a `Promise<T>` resolved via
 * `resolve(correlationId, result)`. A correlation id is injected into
 * `detail._correlationId` (plumbing — never user-supplied) per trigger call.
 *
 * @param bProgram - Callback registering threads/handlers and wiring the
 * Promise bridge. May be async.
 * @returns An `init` function (branded `🎛️`) carrying an `extractThreads`
 * method for frontier analysis.
 *
 * @see {@link isPage} for the runtime type guard
 */
export const definePage = (bProgram: BProgram) => {
  const init = async ({ trigger: baseTrigger, page, ...args }: InitArgs) => {
    const pending = new Map<string, PendingRequest>()

    const resolve: Resolve = (correlationId, result) => {
      const entry = pending.get(correlationId)
      if (entry) {
        entry.resolve(result)
        pending.delete(correlationId)
      }
    }

    /**
     * Promise-backed trigger. Injects the engine `page` namespace directly
     * (no remap) and a `_correlationId` plumbing field into `detail`.
     *
     * @remarks
     * No default timeout — callers (e.g. Hono route handlers) own
     * AbortSignal/timeout lifecycle. Unresolved promises remain in `pending`
     * until `resolve` is called for the matching correlation id.
     */
    const trigger = <T = unknown>(event: BPEvent): Promise<T> => {
      const { promise, resolve: resolvePromise, reject } = Promise.withResolvers<T>()
      const correlationId = crypto.randomUUID()
      pending.set(correlationId, {
        resolve: resolvePromise as (value: unknown) => void,
        reject: reject as (reason: unknown) => void,
      })

      baseTrigger({
        type: event.type,
        page,
        detail: {
          ...(event.detail && event.detail),
          _correlationId: correlationId,
        },
        ...(event.payload !== undefined && { payload: event.payload }),
      })

      return promise
    }

    const sync: Sync = (idioms) => {
      const built: Idioms = {}
      for (const key in idioms) {
        const idiom = key as keyof Idioms
        if (idiom === IDIOMS.request) {
          const { type, detail } = idioms[idiom] as BPEvent
          built[idiom] = {
            type,
            page,
            detail: {
              ...(detail && detail),
            },
          }
          continue
        }
        const value = idioms[idiom]
        built[idiom] = ensureArray(value).map((listener) => ({
          ...listener,
          page,
        }))
      }
      return baseSync(built)
    }

    await bProgram({
      ...args,
      trigger,
      sync,
      thread,
      resolve,
    })
  }
  init.$ = B_PROGRAM_IDENTIFIER

  /**
   * Extracts every thread registered via `addThread` inside the page callback,
   * in registration order, for frontier analysis.
   *
   * @remarks
   * The mock `trigger` returns an immediately-resolved promise so a `bProgram`
   * that awaits `trigger(...)` during setup does not hang — thread registration
   * is captured, trigger results are discarded. Extraction assumes threads are
   * registered statically; thread registration conditioned on a trigger result
   * is a dynamic pattern outside frontier analysis's scope.
   */
  init.extractThreads = async (): Promise<ThreadEntry[]> => {
    const threads: ThreadEntry[] = []
    await bProgram({
      addThread: (label, fn) => {
        threads.push([label, fn as ReturnType<Thread>])
      },
      addHandler: () => () => {},
      reportSnapshot: () => {},
      trigger: (() => Promise.resolve(undefined)) as DefinePageArgs['trigger'],
      sync: baseSync,
      thread,
      resolve: () => {},
    })
    return threads
  }
  return init
}

/**
 * Runtime type guard distinguishing a {@link definePage} page export from a
 * plain thread export.
 *
 * @remarks
 * Checks for the `🎛️` brand ({@link B_PROGRAM_IDENTIFIER}) and that
 * `extractThreads` is a function. Mutually exclusive with {@link isThread}
 * (which brands with `🪢`).
 */
export const isPage = (value: unknown): value is ReturnType<typeof definePage> =>
  typeof value === 'function' &&
  '$' in value &&
  value.$ === B_PROGRAM_IDENTIFIER &&
  'extractThreads' in value &&
  typeof value.extractThreads === 'function'
