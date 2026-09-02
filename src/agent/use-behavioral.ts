import type { AddHandler, AddThread, Trigger, UseTrace } from '../main/behavioral.types.ts'

/**
 * The scoped hooks a behavioral callback receives. These are **already
 * topic-bound** by the harness's provisioning handler (it reads the scope from
 * the `plugin.json` packs object and curries `useTrigger(topic)` /
 * `useAddHandler(topic)` / `useAddThread(topic)`). `useBehavioral` itself does
 * no scoping — it is the consumer-side contract, not the currying point.
 *
 * `useTrace` is included so a self-improving agent can observe its own
 * behavioral exhaust — the core mechanism of
 * `research/talk-self-improving-agents-from-behavioral-exhaust.md`. Whether a
 * callback reacts to its own traces is the pack author's choice, not something
 * the engine prevents by omission.
 */
export type UseBehavioralParams = {
  addThread: AddThread
  addHandler: AddHandler
  trigger: Trigger
  useTrace: UseTrace
}

/**
 * A behavior export — the single unit a pack contributes per named export.
 * The callback's own scope is where co-designed handlers/threads share state
 * and `Disconnect` handles (cross-handler lifecycle within a scope). The
 * engine's `addHandler` returns a `Disconnect` (the caller-held removal path,
 * `plan.md` Phase -1); the callback captures it and hands it to a sibling
 * handler. This needs no engine change — `Handler<T>` stays clean of
 * self-removal, and the pack coordinates its own lifecycles via closure.
 */
export type UseBehavioralCallback = (params: UseBehavioralParams) => void | Promise<void>

/**
 * Consumer-side interface for pack-provided behaviors. Guarantees the export's
 * shape and fixes the param shape so the harness invokes it with pre-scoped
 * hooks.
 *
 * The wrapper is a **pure identity**: it returns the callback untouched. Its
 * only jobs are (1) to name the contract and (2) to fix the `UseBehavioralParams`
 * shape at the call boundary so the harness can invoke the export directly.
 * Scoping (topic currying) happens harness-side in the provisioning handler,
 * not here; closure and cross-handler `Disconnect` sharing live in the
 * callback, not the wrapper. A pure thread-only behavior stays sync — the
 * wrapper must not force `async`.
 */
export const useBehavioral = (callback: UseBehavioralCallback): UseBehavioralCallback => callback
