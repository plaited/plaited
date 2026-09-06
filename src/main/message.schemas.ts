import type { JSONSchemaType } from 'ajv'
import Ajv2020 from 'ajv/dist/2020'
import { type BPEvent, BPEventSchema } from './behavioral.schemas.ts'
import { SCALE } from './html.constants.ts'
import {
  CONTROLLER_INCOMING_MESSAGE_TYPES,
  CONTROLLER_OUTGOING_MESSAGE_TYPES,
  PAGE_EVENTS,
  SWAP_MODES,
} from './message.constants.ts'

/**
 * Shared Ajv instance for controller message validation.
 * `useDefaults` assigns schema defaults during validation (mirroring zod's
 * `.default()`); `validateSchema` rejects structurally-broken schemas early.
 */
const ajv = new Ajv2020({ strict: false, validateSchema: true, useDefaults: true })

/**
 * Element matching strategies in attribute selectors.
 * - '=':  Exact match
 * - '~=': Space-separated list contains
 * - '|=': Exact match or prefix followed by hyphen
 * - '^=': Starts with
 * - '$=': Ends with
 * - '*=': Contains
 */
export type SelectorMatch = '=' | '~=' | '|=' | '^=' | '$=' | '*='

/** SWAP_MODES value union, shared by render and scale-check messages. */
const swapModeSchema: JSONSchemaType<(typeof SWAP_MODES)[keyof typeof SWAP_MODES]> = {
  type: 'string',
  enum: Object.values(SWAP_MODES),
}

// ---------------------------------------------------------------------------
// Client → server messages
// ---------------------------------------------------------------------------

/**
 * Schema for BP events sent from a controller island to the server.
 *
 * @public
 */
export type UiEventMessage = {
  type: typeof CONTROLLER_OUTGOING_MESSAGE_TYPES.ui_event
  detail: { event: BPEvent; timeStamp: number }
}

export const UiEventMessageSchema: JSONSchemaType<UiEventMessage> = {
  type: 'object',
  properties: {
    type: { type: 'string', const: CONTROLLER_OUTGOING_MESSAGE_TYPES.ui_event },
    detail: {
      type: 'object',
      properties: {
        event: BPEventSchema,
        timeStamp: { type: 'number' },
      },
      required: ['event', 'timeStamp'],
      additionalProperties: false,
    },
  },
  required: ['type', 'detail'],
  additionalProperties: false,
}

/**
 * Schema for form submissions emitted directly by controller islands.
 *
 * @public
 */
export type FormSubmitMessage = {
  type: typeof CONTROLLER_OUTGOING_MESSAGE_TYPES.form_submit
  detail: {
    name?: string | null
    timeStamp: number
    action?: string | null
    data?: Record<string, string | string[]>
  }
}

export const FormSubmitMessageSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', const: CONTROLLER_OUTGOING_MESSAGE_TYPES.form_submit },
    detail: {
      type: 'object',
      properties: {
        name: { type: 'string', nullable: true },
        timeStamp: { type: 'number' },
        action: { type: 'string', nullable: true },
        data: {
          type: 'object',
          nullable: true,
          additionalProperties: { anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
        },
      },
      required: ['timeStamp'],
      additionalProperties: false,
    },
  },
  required: ['type', 'detail'],
  additionalProperties: false,
} as unknown as JSONSchemaType<FormSubmitMessage>

/**
 * Schema for controller runtime errors sent from a controller island to the server.
 *
 * @remarks
 * `name` carries the error class (e.g. `ElementNotFoundError`,
 * `ValidationError`); `error` carries the message and `stack` the optional
 * stack trace. These flow back to agent runtimes, so the fields are kept
 * human-readable rather than terse category literals.
 *
 * @public
 */
export type ErrorMessage = {
  type: typeof CONTROLLER_OUTGOING_MESSAGE_TYPES.error
  detail: { timeStamp: number; id?: string; name: string; error?: string; stack?: string }
}

export const ErrorMessageSchema: JSONSchemaType<ErrorMessage> = {
  type: 'object',
  properties: {
    type: { type: 'string', const: CONTROLLER_OUTGOING_MESSAGE_TYPES.error },
    detail: {
      type: 'object',
      properties: {
        timeStamp: { type: 'number' },
        id: { type: 'string', nullable: true },
        name: { type: 'string' },
        error: { type: 'string', nullable: true },
        stack: { type: 'string', nullable: true },
      },
      required: ['timeStamp', 'name'],
      additionalProperties: false,
    },
  },
  required: ['type', 'detail'],
  additionalProperties: false,
}

/**
 * Schema for success acknowledgements sent from a controller island to the
 * server, keyed by the originating command id.
 *
 * @public
 */
export type SuccessMessage = {
  type: typeof CONTROLLER_OUTGOING_MESSAGE_TYPES.success
  detail: { id: string; timeStamp: number }
}

export const SuccessMessageSchema: JSONSchemaType<SuccessMessage> = {
  type: 'object',
  properties: {
    type: { type: 'string', const: CONTROLLER_OUTGOING_MESSAGE_TYPES.success },
    detail: {
      type: 'object',
      properties: { id: { type: 'string' }, timeStamp: { type: 'number' } },
      required: ['id', 'timeStamp'],
      additionalProperties: false,
    },
  },
  required: ['type', 'detail'],
  additionalProperties: false,
}

/**
 * Schema for page snapshots sent from the controller to the server, capturing
 * the serialized DOM at a page lifecycle event.
 *
 * @public
 */
export type PageSnapshot = {
  type: typeof CONTROLLER_OUTGOING_MESSAGE_TYPES.snapshot
  detail: { timeStamp: number; type: (typeof PAGE_EVENTS)[keyof typeof PAGE_EVENTS]; serializedHTML: string }
}

export const PageSnapshotSchema: JSONSchemaType<PageSnapshot> = {
  type: 'object',
  properties: {
    type: { type: 'string', const: CONTROLLER_OUTGOING_MESSAGE_TYPES.snapshot },
    detail: {
      type: 'object',
      properties: {
        timeStamp: { type: 'number' },
        type: { type: 'string', enum: Object.values(PAGE_EVENTS) },
        serializedHTML: { type: 'string' },
      },
      required: ['timeStamp', 'type', 'serializedHTML'],
      additionalProperties: false,
    },
  },
  required: ['type', 'detail'],
  additionalProperties: false,
}

/**
 * Schema for scale-check results sent from the controller/renderer back to the
 * behavioral engine, carrying the resolved effective structural scale.
 *
 * @public
 */
export type ScaleCheckResultMessage = {
  type: typeof CONTROLLER_OUTGOING_MESSAGE_TYPES.scale_check_result
  detail: { id: string; target: string; effectiveScale: (typeof SCALE)[keyof typeof SCALE]; timeStamp: number }
}

export const ScaleCheckResultMessageSchema: JSONSchemaType<ScaleCheckResultMessage> = {
  type: 'object',
  properties: {
    type: { type: 'string', const: CONTROLLER_OUTGOING_MESSAGE_TYPES.scale_check_result },
    detail: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        target: { type: 'string' },
        effectiveScale: { type: 'string', enum: Object.values(SCALE) },
        timeStamp: { type: 'number' },
      },
      required: ['id', 'target', 'effectiveScale', 'timeStamp'],
      additionalProperties: false,
    },
  },
  required: ['type', 'detail'],
  additionalProperties: false,
}

/**
 * Discriminated union of all controller-to-server message kinds.
 * Consumers narrow by the `type` field.
 *
 * @public
 */
export type ClientMessage =
  | UiEventMessage
  | FormSubmitMessage
  | ErrorMessage
  | SuccessMessage
  | PageSnapshot
  | ScaleCheckResultMessage

/** @internal */
export const validateClientMessage = ajv.compile({
  oneOf: [
    UiEventMessageSchema,
    FormSubmitMessageSchema,
    ErrorMessageSchema,
    SuccessMessageSchema,
    PageSnapshotSchema,
    ScaleCheckResultMessageSchema,
  ],
})

// ---------------------------------------------------------------------------
// Server → controller messages
// ---------------------------------------------------------------------------

/**
 * Schema for render messages that insert or replace DOM content.
 *
 * @public
 */
export type RenderMessage = {
  type: typeof CONTROLLER_INCOMING_MESSAGE_TYPES.render
  detail: {
    id: string
    target: string
    html: string
    match?: SelectorMatch
    swap: (typeof SWAP_MODES)[keyof typeof SWAP_MODES]
  }
}

export const RenderMessageSchema: JSONSchemaType<RenderMessage> = {
  type: 'object',
  properties: {
    type: { type: 'string', const: CONTROLLER_INCOMING_MESSAGE_TYPES.render },
    detail: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        target: { type: 'string' },
        html: { type: 'string' },
        match: { type: 'string', enum: ['=', '~=', '|=', '^=', '$=', '*='], nullable: true },
        swap: swapModeSchema,
      },
      required: ['id', 'target', 'html', 'swap'],
      additionalProperties: false,
    },
  },
  required: ['type', 'detail'],
  additionalProperties: false,
}

/**
 * Schema for attrs messages that update element attributes.
 *
 * @public
 */
export type AttrsMessage = {
  type: typeof CONTROLLER_INCOMING_MESSAGE_TYPES.attrs
  detail: {
    id: string
    target: string
    match?: SelectorMatch
    attr: Record<string, string | number | boolean | null>
  }
}

export const AttrsMessageSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', const: CONTROLLER_INCOMING_MESSAGE_TYPES.attrs },
    detail: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        target: { type: 'string' },
        match: { type: 'string', enum: ['=', '~=', '|=', '^=', '$=', '*='], nullable: true },
        attr: {
          type: 'object',
          required: [],
          additionalProperties: {
            anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }, { type: 'null' }],
          },
        } as unknown as JSONSchemaType<Record<string, string | number | boolean | null>>,
      },
      required: ['id', 'target', 'attr'],
      additionalProperties: false,
    },
  },
  required: ['type', 'detail'],
  additionalProperties: false,
} as unknown as JSONSchemaType<AttrsMessage>

/**
 * Schema for dispatch-custom-event messages that instruct the controller to
 * dispatch a BP event as a custom DOM event on a target element.
 *
 * @public
 */
export type DispatchCustomEventMessage = {
  type: typeof CONTROLLER_INCOMING_MESSAGE_TYPES.dispatch_custom_event
  detail: {
    id: string
    target: string
    event: BPEvent
    bubbles?: boolean
    cancelable?: boolean
    composed?: boolean
  }
}

export const DispatchCustomEventMessageSchema: JSONSchemaType<DispatchCustomEventMessage> = {
  type: 'object',
  properties: {
    type: { type: 'string', const: CONTROLLER_INCOMING_MESSAGE_TYPES.dispatch_custom_event },
    detail: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        target: { type: 'string' },
        event: BPEventSchema,
        bubbles: { type: 'boolean', default: false, nullable: true },
        cancelable: { type: 'boolean', default: true, nullable: true },
        composed: { type: 'boolean', default: true, nullable: true },
      },
      required: ['id', 'target', 'event'],
      additionalProperties: false,
    },
  },
  required: ['type', 'detail'],
  additionalProperties: false,
}

/**
 * Schema for navigate messages that instruct the controller to navigate to a
 * URL.
 *
 * @remarks
 * When `replace` is `true` the controller uses `location.replace`, otherwise
 * it defaults to `location.assign`.
 *
 * @public
 */
export type NavigateMessage = {
  type: typeof CONTROLLER_INCOMING_MESSAGE_TYPES.navigate
  detail: { id: string; url: string; replace?: boolean }
}

export const NavigateMessageSchema: JSONSchemaType<NavigateMessage> = {
  type: 'object',
  properties: {
    type: { type: 'string', const: CONTROLLER_INCOMING_MESSAGE_TYPES.navigate },
    detail: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        url: { type: 'string' },
        replace: { type: 'boolean', default: false, nullable: true },
      },
      required: ['id', 'url'],
      additionalProperties: false,
    },
  },
  required: ['type', 'detail'],
  additionalProperties: false,
}

/**
 * Schema for scale-check messages that pre-flight a `render` to learn the
 * structural scale context the content must respect.
 *
 * @remarks
 * Advisory only — does not enforce nesting. The agent sends this before
 * `render` to learn the `p-scale` boundary. The Controller/Renderer walk the
 * matched target's `p-scale` (or nearest ancestor's) and reply with a
 * {@link ScaleCheckResultMessage}.
 *
 * @public
 */
export type ScaleCheckMessage = {
  type: typeof CONTROLLER_INCOMING_MESSAGE_TYPES.scale_check
  detail: { id: string; target: string; swap: (typeof SWAP_MODES)[keyof typeof SWAP_MODES]; match?: SelectorMatch }
}

export const ScaleCheckMessageSchema: JSONSchemaType<ScaleCheckMessage> = {
  type: 'object',
  properties: {
    type: { type: 'string', const: CONTROLLER_INCOMING_MESSAGE_TYPES.scale_check },
    detail: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        target: { type: 'string' },
        swap: swapModeSchema,
        match: { type: 'string', enum: ['=', '~=', '|=', '^=', '$=', '*='], nullable: true },
      },
      required: ['id', 'target', 'swap'],
      additionalProperties: false,
    },
  },
  required: ['type', 'detail'],
  additionalProperties: false,
}

/**
 * Discriminated union of all server-to-controller message kinds.
 * Consumers narrow by the `type` field.
 *
 * @public
 */
export type ServerMessage =
  | RenderMessage
  | AttrsMessage
  | DispatchCustomEventMessage
  | NavigateMessage
  | ScaleCheckMessage

/** @internal */
export const validateServerMessage = ajv.compile({
  oneOf: [
    RenderMessageSchema,
    AttrsMessageSchema,
    DispatchCustomEventMessageSchema,
    NavigateMessageSchema,
    ScaleCheckMessageSchema,
  ],
})
