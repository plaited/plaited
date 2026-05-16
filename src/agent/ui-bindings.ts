import * as z from 'zod'

import type { Behavioral, BPEvent, Disconnect, JsonObject } from '../behavioral.ts'
import { SNAPSHOT_MESSAGE_KINDS, SpecSchema, useSpec } from '../behavioral.ts'
import { CONTROLLER_TO_AGENT_EVENTS } from '../shared.ts'
import type { createContextMemory } from './context-memory.ts'

type AgentRuntime = ReturnType<Behavioral>

type ContextMemory = ReturnType<typeof createContextMemory>

type UiCapabilityActionMappingValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | { [key: string]: UiCapabilityActionMappingValue }

const UiCapabilityActionMappingValueSchema: z.ZodType<UiCapabilityActionMappingValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(z.string()).min(1),
    z.record(z.string(), UiCapabilityActionMappingValueSchema),
  ]),
)

/**
 * Validates one semantic UI event declaration in a capability binding.
 *
 * @remarks
 * The `detailSchema` field stores JSON Schema for the inner BP event detail
 * emitted by controller `ui_event` messages.
 *
 * @public
 */
export const UiCapabilityEventSchema = z.object({
  detailSchema: z.record(z.string(), z.json()),
})

/**
 * Semantic UI event declaration accepted by generated capability bindings.
 *
 * @remarks
 * Event declarations are keyed by BP event type on {@link UiCapabilityBinding}
 * and are used to validate controller-originated semantic event details before
 * they enter Behavioral.
 *
 * @public
 */
export type UiCapabilityEvent = z.output<typeof UiCapabilityEventSchema>

/**
 * Validates a declarative mapping from a semantic UI event to a generic request event.
 *
 * @remarks
 * `when` names the semantic BP event, `request` names the generic handler
 * surface to request, and `mapping` describes literal values or event-detail
 * lookup paths used to build the request detail.
 *
 * @public
 */
export const UiCapabilityActionMappingSchema = z.object({
  when: z.string().min(1),
  request: z.string().min(1),
  mapping: z.record(z.string(), UiCapabilityActionMappingValueSchema),
})

/**
 * Declarative action mapping attached to a generated UI capability.
 *
 * @remarks
 * Action mappings let a capability request generic handler surfaces such as
 * `ui_state.patch_requested` without registering a custom handler for each
 * semantic UI event.
 *
 * @public
 */
export type UiCapabilityActionMapping = z.output<typeof UiCapabilityActionMappingSchema>

/**
 * Validates the complete generated UI capability binding contract.
 *
 * @remarks
 * Capability bindings declare semantic event schemas, generated Behavioral
 * specs, generic action mappings, template refs, projection hints, and the
 * generic handler surfaces required before activation.
 *
 * @public
 */
export const UiCapabilityBindingSchema = z.object({
  capabilityId: z.string().min(1),
  events: z.record(z.string(), UiCapabilityEventSchema).default({}),
  specs: z.array(SpecSchema).default([]),
  actions: z.array(UiCapabilityActionMappingSchema).default([]),
  templateRefs: z.array(z.string().min(1)).default([]),
  projectionHints: z.record(z.string(), z.json()).default({}),
  requiredHandlerSurfaces: z.array(z.string().min(1)).default([]),
})

/**
 * Generated UI capability binding consumed by the agent runtime.
 *
 * @remarks
 * This type is intentionally capability-local: multiple capabilities can
 * declare the same semantic event type, while activation coordinates shared
 * semantic dispatch and per-capability action mappings.
 *
 * @public
 */
export type UiCapabilityBinding = z.output<typeof UiCapabilityBindingSchema>

type UiCapabilityDispatcher = {
  capabilities: Set<UiCapabilityBinding>
  disconnect: Disconnect
}

const capabilityDispatchers = new WeakMap<AgentRuntime, UiCapabilityDispatcher>()

const getTopicScope = (detail: JsonObject | undefined): string | undefined => {
  const topic = detail?.topic
  return typeof topic === 'string' && topic.length > 0 ? `topic:${topic}` : undefined
}

const isJsonObject = (value: unknown): value is JsonObject => {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

const resolvePath = ({ event, path }: { event: BPEvent; path: string[] }): unknown => {
  let current: unknown = event
  for (const segment of path) {
    if (!isJsonObject(current) || !(segment in current)) {
      throw new Error(`Unable to resolve UI capability action mapping path: ${path.join('.')}`)
    }
    current = current[segment]
  }
  return current
}

const resolveMappingValue = ({ event, value }: { event: BPEvent; value: UiCapabilityActionMappingValue }): unknown => {
  if (Array.isArray(value)) return resolvePath({ event, path: value })
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, childValue]) => [
        key,
        resolveMappingValue({
          event,
          value: childValue,
        }),
      ]),
    )
  }
  return value
}

const resolveActionMapping = ({
  event,
  mapping,
}: {
  event: BPEvent
  mapping: UiCapabilityActionMapping['mapping']
}): JsonObject => {
  return Object.fromEntries(
    Object.entries(mapping).map(([key, value]) => [
      key,
      resolveMappingValue({
        event,
        value,
      }),
    ]),
  ) as JsonObject
}

const stringifyError = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error)
}

const reportCapabilityFeedbackError = ({
  runtime,
  capability,
  detail,
  error,
}: {
  runtime: AgentRuntime
  capability: UiCapabilityBinding
  detail: JsonObject
  error: unknown
}) => {
  runtime.reportSnapshot({
    kind: SNAPSHOT_MESSAGE_KINDS.feedback_error,
    type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
    detail,
    error: `[${capability.capabilityId}] ${stringifyError(error)}`,
  })
}

const activateCapabilityForEvent = ({
  runtime,
  capability,
  detail,
  emittedTypes,
}: {
  runtime: AgentRuntime
  capability: UiCapabilityBinding
  detail: JsonObject
  emittedTypes: Set<string>
}) => {
  const type = detail.type
  if (typeof type !== 'string') return
  if (!capability.events[type]) return
  const eventDetail = validateUiCapabilityEventDetail({
    capability,
    type,
    detail: detail.detail,
  })
  if (!isJsonObject(eventDetail)) throw new Error(`UI capability event detail must be an object: ${type}`)
  const event = {
    type,
    detail: eventDetail,
  }

  if (!emittedTypes.has(type)) {
    emittedTypes.add(type)
    runtime.trigger(event)
  }

  for (const action of capability.actions) {
    if (action.when !== type) continue
    runtime.trigger({
      type: action.request,
      detail: resolveActionMapping({
        event,
        mapping: action.mapping,
      }),
    })
  }
}

/**
 * Returns the generic handler surfaces required by a UI capability.
 *
 * @param capability - Capability binding to inspect.
 * @returns Unique handler surface names required by explicit declarations and action mappings.
 *
 * @remarks
 * Action mapping request types are treated as required surfaces so activation
 * can fail before a generated capability starts handling controller events.
 *
 * @public
 */
export const getRequiredUiCapabilityHandlerSurfaces = (capability: UiCapabilityBinding): string[] => {
  const parsedCapability = UiCapabilityBindingSchema.parse(capability)
  return Array.from(
    new Set([...parsedCapability.requiredHandlerSurfaces, ...parsedCapability.actions.map((action) => action.request)]),
  )
}

/**
 * Verifies that every required generic handler surface is available.
 *
 * @param capability - Capability binding whose handler requirements should be checked.
 * @param availableHandlerSurfaces - Generic handler surface names currently installed for the runtime.
 *
 * @remarks
 * This check validates generic surfaces only. It does not require handlers named
 * after semantic UI events, preserving generated capability portability.
 *
 * @throws When one or more required generic handler surfaces are unavailable.
 *
 * @public
 */
export const verifyUiCapabilityHandlerSurfaces = ({
  capability,
  availableHandlerSurfaces,
}: {
  capability: UiCapabilityBinding
  availableHandlerSurfaces: ReadonlySet<string>
}): void => {
  const missing = getRequiredUiCapabilityHandlerSurfaces(capability).filter(
    (surface) => !availableHandlerSurfaces.has(surface),
  )
  if (missing.length > 0) {
    throw new Error(`Missing required UI capability handler surfaces: ${missing.join(', ')}`)
  }
}

const disconnectAll =
  (disconnects: Disconnect[]): Disconnect =>
  () => {
    for (const disconnect of disconnects) void disconnect()
  }

/**
 * Records controller-originated events into scoped agent context memory.
 *
 * @param runtime - Behavioral runtime that receives controller client messages.
 * @param memory - Context memory instance that stores latest event details by scope.
 * @returns Disconnect callback that removes all installed runtime handlers.
 *
 * @remarks
 * The agent layer owns the topic scope convention. Controller `ui_event`
 * messages store their inner BP event detail under `topic:<topic>`, while
 * `form_submit` and controller `error` messages store their original detail
 * under the same explicit scope convention.
 *
 * @public
 */
export const bindControllerEventContextMemory = ({
  runtime,
  memory,
}: {
  runtime: AgentRuntime
  memory: ContextMemory
}): Disconnect => {
  const disconnects = [
    runtime.addHandler<JsonObject>(CONTROLLER_TO_AGENT_EVENTS.ui_event, (detail) => {
      const innerType = detail.type
      const innerDetail = detail.detail
      if (
        typeof innerType !== 'string' ||
        !innerDetail ||
        typeof innerDetail !== 'object' ||
        Array.isArray(innerDetail)
      ) {
        return
      }
      const scope = getTopicScope(innerDetail as JsonObject)
      if (!scope) return
      memory.record({
        type: innerType,
        detail: innerDetail,
        scope,
      })
    }),
    runtime.addHandler<JsonObject>(CONTROLLER_TO_AGENT_EVENTS.form_submit, (detail) => {
      const scope = getTopicScope(detail)
      if (!scope) return
      memory.record({
        type: CONTROLLER_TO_AGENT_EVENTS.form_submit,
        detail,
        scope,
      })
    }),
    runtime.addHandler<JsonObject>(CONTROLLER_TO_AGENT_EVENTS.error, (detail) => {
      const scope = getTopicScope(detail)
      if (!scope) return
      memory.record({
        type: CONTROLLER_TO_AGENT_EVENTS.error,
        detail,
        scope,
      })
    }),
  ]

  return disconnectAll(disconnects)
}

/**
 * Validates one semantic event detail against a capability-declared event schema.
 *
 * @param capability - Capability binding that declares accepted semantic events.
 * @param type - Semantic BP event type to validate.
 * @param detail - Candidate event detail from a controller `ui_event` message.
 * @returns Parsed event detail from the declared JSON Schema.
 *
 * @remarks
 * Unknown event types are errors for direct validation. Activation filters
 * undeclared event types before calling this helper so unrelated controller
 * events do not produce feedback errors.
 *
 * @throws When the event type is undeclared or the detail does not satisfy the declared schema.
 *
 * @public
 */
export const validateUiCapabilityEventDetail = ({
  capability,
  type,
  detail,
}: {
  capability: UiCapabilityBinding
  type: string
  detail: unknown
}): unknown => {
  const parsedCapability = UiCapabilityBindingSchema.parse(capability)
  const event = parsedCapability.events[type]
  if (!event) throw new Error(`Unknown UI capability event: ${type}`)
  return z.fromJSONSchema(event.detailSchema).parse(detail)
}

const getUiCapabilityDispatcher = (runtime: AgentRuntime): UiCapabilityDispatcher => {
  const current = capabilityDispatchers.get(runtime)
  if (current) return current

  const capabilities = new Set<UiCapabilityBinding>()
  const disconnect = runtime.addHandler<JsonObject>(CONTROLLER_TO_AGENT_EVENTS.ui_event, (detail) => {
    const emittedTypes = new Set<string>()
    for (const capability of capabilities) {
      try {
        activateCapabilityForEvent({
          runtime,
          capability,
          detail,
          emittedTypes,
        })
      } catch (error) {
        reportCapabilityFeedbackError({
          runtime,
          capability,
          detail,
          error,
        })
      }
    }
  })
  const dispatcher = {
    capabilities,
    disconnect,
  }
  capabilityDispatchers.set(runtime, dispatcher)
  return dispatcher
}

/**
 * Activates generated UI capability bindings for a Behavioral runtime.
 *
 * @param runtime - Behavioral runtime that receives controller events and emits generic requests.
 * @param capability - Capability binding to validate and activate.
 * @param availableHandlerSurfaces - Generic handler surfaces available to the runtime.
 * @returns Disconnect callback that deactivates this capability binding.
 *
 * @remarks
 * Activation installs generated specs and registers the capability with a
 * runtime-scoped `ui_event` dispatcher. Each controller event dispatch re-emits
 * a declared semantic BP event at most once per runtime, even when overlapping
 * capabilities declare the same event, while each capability still runs its own
 * action mappings. Per-capability failures are reported as `feedback_error`
 * snapshots and do not prevent later capabilities from handling the same event.
 *
 * @throws When required generic handler surfaces are unavailable.
 *
 * @public
 */
export const activateUiCapabilityBindings = ({
  runtime,
  capability,
  availableHandlerSurfaces,
}: {
  runtime: AgentRuntime
  capability: UiCapabilityBinding
  availableHandlerSurfaces: ReadonlySet<string>
}): Disconnect => {
  const parsedCapability = UiCapabilityBindingSchema.parse(capability)
  verifyUiCapabilityHandlerSurfaces({
    capability: parsedCapability,
    availableHandlerSurfaces,
  })

  for (const spec of parsedCapability.specs) {
    const [label, thread] = useSpec(spec)
    runtime.addThread(label, thread)
  }

  const dispatcher = getUiCapabilityDispatcher(runtime)
  dispatcher.capabilities.add(parsedCapability)

  return () => {
    dispatcher.capabilities.delete(parsedCapability)
    if (dispatcher.capabilities.size > 0) return
    dispatcher.disconnect()
    capabilityDispatchers.delete(runtime)
  }
}
