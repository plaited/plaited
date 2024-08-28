import type {
  Trigger,
  Actions,
  UseSnapshot,
  Synchronize,
  SynchronizationPoint,
  BThreads,
  BPEvent,
} from '../behavioral/types.js'
import type { TemplateObject, Attrs, FunctionTemplate, CustomElementTag } from '../jsx/types.js'
import type { PLAITED_TEMPLATE_IDENTIFIER } from '../shared/constants.js'
import { P_HANDLER } from './constants.js'
import type { Publisher } from './use-publisher.js'
import type { SendToHandler } from './use-handler.js'
import type { Disconnect } from '../shared/types.js'
import { UPDATE_LIGHT_DOM, UPDATE_LIGHT_DOM_METHODS, TRIGGER_ELEMENT } from '../shared/constants.js'
import { ValueOf } from '@plaited/utils'
import { callbacks } from './constants.js'

export type Bindings = {
  render(this: Element, ...template: (TemplateObject | DocumentFragment | Element | string)[]): void
  insert(this: Element, position: Position, ...template: (TemplateObject | DocumentFragment | Element | string)[]): void
  replace(this: Element, ...template: (TemplateObject | DocumentFragment | Element | string)[]): void
  attr(this: Element, attr: Record<string, string | null | number | boolean>, val?: never): void
  attr(this: Element, attr: string, val?: string | null | number | boolean): string | null | void
}

export type BoundElement<T extends Element = Element> = T & Bindings

export type Position = 'beforebegin' | 'afterbegin' | 'beforeend' | 'afterend'

export type SelectorMatch = '=' | '~=' | '|=' | '^=' | '$=' | '*='

export interface QuerySelector {
  <T extends Element = Element>(
    target: string,
    /** This options enables querySelectorAll and modified the attribute selector for p-target{@default {all: false, mod: "=" } } {@link https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors#syntax}*/
    match?: SelectorMatch,
  ): BoundElement<T>[]
}

export type Clone = <T>(
  template: TemplateObject,
  callback: ($: QuerySelector, data: T) => void,
) => (data: T) => DocumentFragment

export type Emit = <T = unknown>(
  args: BPEvent<T> & {
    bubbles?: boolean
    cancelable?: boolean
    composed?: boolean
  },
) => void

export interface PlaitedElement extends HTMLElement {
  // Custom Methods and properties
  trigger: Trigger
  readonly publicEvents?: string[]
  adoptedCallback?: { (this: PlaitedElement): void }
  attributeChangedCallback?: {
    (this: PlaitedElement, name: string, oldValue: string | null, newValue: string | null): void
  }
  connectedCallback(this: PlaitedElement): void
  disconnectedCallback(this: PlaitedElement): void
  formAssociatedCallback(this: PlaitedElement, form: HTMLFormElement): void
  formDisabledCallback(this: PlaitedElement, disabled: boolean): void
  formResetCallback(this: PlaitedElement): void
  formStateRestoreCallback(this: PlaitedElement, state: unknown, reason: 'autocomplete' | 'restore'): void
}

export interface PlaitedElementConstructor {
  new (): PlaitedElement
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SubscribeToPublisher = (target: Publisher<any>, type: string) => Disconnect

export type PostToWorker = {
  <T>(args: BPEvent<T>): void
  disconnect(): void
}

export type ConnectedCallbackArgs = {
  $: QuerySelector
  root: ShadowRoot
  internals: ElementInternals
  emit: Emit
  clone: Clone
  subscribe: SubscribeToPublisher
  send: { handler: SendToHandler; worker: PostToWorker }
  // OnlyConnectedCallbackArgs
  trigger: Trigger
  bThreads: BThreads
  useSnapshot: UseSnapshot
  sync: Synchronize
  point: SynchronizationPoint
}

export type PlaitedElementCallbackActions = {
  [callbacks.onAdopted]?: () => void | Promise<void>
  [callbacks.onAttributeChanged]?: (args: {
    name: string
    oldValue: string | null
    newValue: string | null
  }) => void | Promise<void>
  [callbacks.onDisconnected]?: () => void | Promise<void>
  [callbacks.onFormAssociated]?: (args: { form: HTMLFormElement }) => void | Promise<void>
  [callbacks.onFormDisabled]?: (args: { disabled: boolean }) => void | Promise<void>
  [callbacks.onFormReset]?: () => void | Promise<void>
  [callbacks.onFormStateRestore]?: (args: {
    state: unknown
    reason: 'autocomplete' | 'restore'
  }) => void | Promise<void>
}

type RequirePlaitedElementCallbackActions = Required<PlaitedElementCallbackActions>

export type PlaitedElementCallbackParameters = {
  [K in keyof RequirePlaitedElementCallbackActions]: Parameters<RequirePlaitedElementCallbackActions[K]> extends (
    undefined
  ) ?
    undefined
  : Parameters<RequirePlaitedElementCallbackActions[K]>[0]
}

export type DefinePlaitedTemplateArgs = {
  tag: CustomElementTag
  shadowDom: TemplateObject
  delegatesFocus?: boolean
  mode?: 'open' | 'closed'
  slotAssignment?: 'named' | 'manual'
  observedAttributes?: string[]
  publicEvents?: string[]
  formAssociated?: true
  connectedCallback?: {
    (this: PlaitedElement, args: ConnectedCallbackArgs): Actions<PlaitedElementCallbackActions>
  }
}

export type PlaitedTemplateAttrs = Attrs & {
  [P_HANDLER]?: string
}

export type PlaitedTemplate<T extends PlaitedTemplateAttrs = PlaitedTemplateAttrs> = FunctionTemplate<T> & {
  registry: Set<string>
  tag: CustomElementTag
  observedAttributes: string[]
  publicEvents: string[]
  $: typeof PLAITED_TEMPLATE_IDENTIFIER
}

export type SendClientMessage = {
  address: string
  event: BPEvent<string>
}

export type PlaitedActionParam = {
  append: () => void
  prepend: () => void
  render: () => void
}

export type SendSocketDetail = string | number | boolean | null | JsonObject | JsonArray

interface JsonObject {
  [key: string]: SendSocketDetail
}

interface JsonArray extends Array<SendSocketDetail> {}

export interface PlaitedPopStateEvent extends PopStateEvent {
  state: { plaited: string; id: number }
}

export type NavigateEventDetail = { href: string; clientX: number; clientY: number }

export type UpdateLightDomMethods = 'replaceChildren' | 'prepend' | 'append'

export type UpdateLightDomMessage = {
  address: string
  action: typeof UPDATE_LIGHT_DOM
  method: ValueOf<typeof UPDATE_LIGHT_DOM_METHODS>
  html: string
}

export type TriggerElementMessage = {
  address: string
  action: typeof TRIGGER_ELEMENT
  event: BPEvent<string>
}

export type AttachShadowOptions = {
  delegatesFocus: boolean
  mode: 'open' | 'closed'
  slotAssignment: 'named' | 'manual'
}
