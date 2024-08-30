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
import { ELEMENT_CALLBACKS } from './constants.js'

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
  [ELEMENT_CALLBACKS.onAdopted]?: () => void | Promise<void>
  [ELEMENT_CALLBACKS.onAttributeChanged]?: (args: {
    name: string
    oldValue: string | null
    newValue: string | null
  }) => void | Promise<void>
  [ELEMENT_CALLBACKS.onDisconnected]?: () => void | Promise<void>
  [ELEMENT_CALLBACKS.onFormAssociated]?: (args: { form: HTMLFormElement }) => void | Promise<void>
  [ELEMENT_CALLBACKS.onFormDisabled]?: (args: { disabled: boolean }) => void | Promise<void>
  [ELEMENT_CALLBACKS.onFormReset]?: () => void | Promise<void>
  [ELEMENT_CALLBACKS.onFormStateRestore]?: (args: {
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

export interface PlaitedPopStateEvent extends PopStateEvent {
  state: { plaited: string; id: number }
}

export type NavigateEventDetail = { href: string; clientX: number; clientY: number }
