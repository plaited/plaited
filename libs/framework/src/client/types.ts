import type * as CSS from 'csstype'
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
import type { PLAITED_COMPONENT_IDENTIFIER } from '../shared/constants.js'
import { P_SOCKET } from './constants.js'
import { Connect } from './use-connect.js'

export type CSSProperties = CSS.Properties<string | number> & {
  [key: string]: string | number
}

export type CreateNestedCSS<T extends keyof CSSProperties> = {
  default?: CSSProperties[T]
  [key: `@${'container' | 'layer' | 'media' | 'supports'}${string}`]: CSSProperties[T]
  [key: `:${string}`]: CSSProperties[T] | CreateNestedCSS<T>
  [key: `[${string}`]: CSSProperties[T] | CreateNestedCSS<T>
}

export type CreateCSS = {
  [key: string]: {
    [key in keyof CSSProperties]: CSSProperties[key] | CreateNestedCSS<key> | string
  }
}
export type CreateHostCSSWithSelector<T extends keyof CSSProperties> = {
  [key: string]: CSSProperties[T]
}
export type CreateHostCSS = {
  [key in keyof CSSProperties]: CSSProperties[key] | CreateHostCSSWithSelector<key>
}

export type CreateKeyframeCSS = {
  from?: { [key in keyof CSSProperties]: CSSProperties[key] }
  to?: { [key in keyof CSSProperties]: CSSProperties[key] }
  [key: `${number}%`]: { [key in keyof CSSProperties]: CSSProperties[key] }
}

export type AssignStylesObject = {
  className?: string | Array<string | undefined | false | null>
  stylesheet?: string | Array<string | undefined | false | null>
}

export type CreateStylesObjects<T extends CreateCSS> = {
  [key in keyof T]: {
    className: string
    stylesheet: string[]
  }
}

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
  // Default Methods and Properties
  internals_: ElementInternals
  adoptedCallback?: { (this: PlaitedElement): void }
  attributeChangedCallback?: {
    (this: PlaitedElement, name: string, oldValue: string | null, newValue: string | null): void
  }
  connectedCallback(this: PlaitedElement): void
  disconnectedCallback(this: PlaitedElement): void
  formAssociatedCallback?: { (this: PlaitedElement, form: HTMLFormElement): void }
  formDisabledCallback?: { (this: PlaitedElement, disabled: boolean): void }
  formResetCallback?: { (this: PlaitedElement): void }
  formStateRestoreCallback?: { (this: PlaitedElement, state: unknown, reason: 'autocomplete' | 'restore'): void }
}

export interface PlaitedElementConstructor {
  new (): PlaitedElement
}

export type ConnectedCallbackArgs = {
  $: QuerySelector
  host: PlaitedElement
  emit: Emit
  clone: Clone
  connect: Connect
  // Behavioral Program
  trigger: Trigger
  bThreads: BThreads
  useSnapshot: UseSnapshot
  sync: Synchronize
  point: SynchronizationPoint
}

export type DefinePlaitedTemplateArgs = {
  tag: CustomElementTag
  shadowDom: TemplateObject
  mode?: 'open' | 'closed'
  delegatesFocus?: boolean
  observedAttributes?: string[]
  publicEvents?: string[]
  formAssociated?: true
  connectedCallback?: {
    (this: PlaitedElement, args: ConnectedCallbackArgs): Actions
  }
  adoptedCallback?: { (this: PlaitedElement): void }
  attributeChangedCallback?: {
    (this: PlaitedElement, name: string, oldValue: string | null, newValue: string | null): void
  }
  disconnectedCallback?: { (this: PlaitedElement): void }
  formAssociatedCallback?: { (this: PlaitedElement, form: HTMLFormElement): void }
  formDisabledCallback?: { (this: PlaitedElement, disabled: boolean): void }
  formResetCallback?: { (this: PlaitedElement): void }
  formStateRestoreCallback?: { (this: PlaitedElement, state: unknown, reason: 'autocomplete' | 'restore'): void }
}

export type PlaitedTemplateAttrs = Attrs & {
  [P_SOCKET]?: string
}

export type PlaitedTemplate<T extends PlaitedTemplateAttrs = PlaitedTemplateAttrs> = FunctionTemplate<T> & {
  registry: Set<string>
  tag: CustomElementTag
  observedAttributes: string[]
  publicEvents: string[]
  $: typeof PLAITED_COMPONENT_IDENTIFIER
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

export type ViewTransition = {
  ready: Promise<never>
  updateCallbackDone: Promise<void>
  finished: Promise<void>
  skipTransition: () => void
  types: string[]
}

export type InitPlaitedArgs = {
  retry?: number
  retryDelay?: number
  skipViewTransition?: () => boolean
  viewTransitionCallback?: (transition: ViewTransition) => Promise<void>
  viewTransitionTypes?: string[]
} & RequestInit
