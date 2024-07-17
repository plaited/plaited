import type { Actions, BProgram, Devtool, Trigger, BPEvent } from '../behavioral/types.js'
import type { TemplateObject, Attrs, FunctionTemplate } from '../jsx/types.js'
import type { PLAITED_COMPONENT_IDENTIFIER } from '../shared/constants.js'

export type Disconnect = () => void

export type Position = 'beforebegin' | 'afterbegin' | 'beforeend' | 'afterend'

export type SelectorMatch = '=' | '~=' | '|=' | '^=' | '$=' | '*='

export interface QuerySelector {
  <T extends Element = Element>(
    target: string,
    /** This options enables querySelectorAll and modified the attribute selector for bp-target{@default {all: false, mod: "=" } } {@link https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors#syntax}*/
    match?: SelectorMatch,
  ): SugaredElement<T>[]
}

export type Sugar = {
  render(this: Element, ...template: (TemplateObject | DocumentFragment | Element | string)[]): void
  insert(this: Element, position: Position, ...template: (TemplateObject | DocumentFragment | Element | string)[]): void
  replace(this: Element, ...template: (TemplateObject | DocumentFragment | Element | string)[]): void
  attr(this: Element, attr: Record<string, string | null | number | boolean>, val?: never): void
  attr(this: Element, attr: string, val?: string | null | number | boolean): string | null | void
}

export type SugaredElement<T extends Element = Element> = T & Sugar

/** Clone feature for handling list situations where structure is consistent but the data rendered is what is different. This is a performance feature */
export type UseClone = (
  shadowRoot: ShadowRoot,
) => <T>(template: TemplateObject, callback: ($: QuerySelector, data: T) => void) => (data: T) => DocumentFragment

export interface PlaitedElement extends HTMLElement {
  internals_: ElementInternals
  trigger: Trigger
  connectedCallback(this: PlaitedElement): void
  attributeChangedCallback?(name: string, oldValue: string | null, newValue: string | null): void
  disconnectedCallback(this: PlaitedElement): void
  adoptedCallback?(this: PlaitedElement): void
  formAssociatedCallback?(this: PlaitedElement, form: HTMLFormElement): void
  formDisabledCallback?(this: PlaitedElement, disabled: boolean): void
  formResetCallback?(this: PlaitedElement): void
  formStateRestoreCallback?(this: PlaitedElement, state: unknown, reason: 'autocomplete' | 'restore'): void
  readonly publicEvents?: string[]
}

export interface PlaitedElementConstructor {
  new (): PlaitedElement
}


export type SocketMessage<T = unknown> = {
  address: string
  event: BPEvent<T>
}

export type UseSocket = {
  (address: string): {
    <T>(event: BPEvent<T>): void;
    subscribe: (address: string, trigger: Trigger) => Disconnect;
    type: 'socket'
  }
}

export type UseAjax = (shadowRoot: ShadowRoot) => Disconnect

export type UsePublisher = {
  (): {
    <T = unknown>(value?: T): void
    sub: (type: string, trigger: Trigger) => () => void
    type: 'publisher'
  }
}

export type UseWorker = {
  (
    scriptURL: string | URL,
    options?: WorkerOptions,
  ): {
    (args: BPEvent): void
    connect(trigger: Trigger): Disconnect
    type: 'worker'
  }
}

export type ConnectArgs = [ReturnType<UseWorker>] | [string, ReturnType<UsePublisher>] | [ReturnType<UseSocket>]

export type UseEmit = (host: HTMLElement) => (
  args: BPEvent & {
    bubbles?: boolean
    cancelable?: boolean
    composed?: boolean
  },
) => void

type BProps = {
  /** query for elements with the bp-target attribute in the Island's shadowDom and slots */
  $: QuerySelector
  /** The DOM node context allowing easy light & shadow dom access
   * @example
   * // returns the div element inside
   * // the shadowRoot of the element instance
   * const shadowEl = host.shadowRoot.querySelector('div')
   */
  host: PlaitedElement
  emit: ReturnType<UseEmit>
  clone: ReturnType<UseClone>
  connect: (...args: ConnectArgs) => Disconnect
} & Omit<ReturnType<BProgram>, 'feedback'>

type BPMethod = (this: PlaitedElement, props: BProps) => Actions

export type GetPlaitedElementArgs = {
  tag: `${string}-${string}`
  template: TemplateObject
  mode?: 'open' | 'closed'
  delegatesFocus?: boolean
  observedAttributes?: string[]
  publicEvents?: string[]
  devtool?: Devtool
  connectedCallback?(this: PlaitedElement): void
  attributeChangedCallback?(this: PlaitedElement, name: string, oldValue: string | null, newValue: string | null): void
  disconnectedCallback?(this: PlaitedElement): void
  adoptedCallback?(this: PlaitedElement): void
  formAssociatedCallback?(this: PlaitedElement, form: HTMLFormElement): void
  formDisabledCallback?(this: PlaitedElement, disabled: boolean): void
  formResetCallback?(this: PlaitedElement): void
  formStateRestoreCallback?(this: PlaitedElement, state: unknown, reason: 'autocomplete' | 'restore'): void
  bp?: BPMethod
}

export type PlaitedTemplate<T extends Attrs = Attrs> = FunctionTemplate<T> & {
  registry: Set<string>
  tag: `${string}-${string}`
  $: typeof PLAITED_COMPONENT_IDENTIFIER
}


export type PlaitedComponent = <T extends Attrs = Attrs>( args: GetPlaitedElementArgs) => PlaitedTemplate<T>


