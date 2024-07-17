import type { Actions, BProgram, Devtool, Trigger, BPEvent } from '../behavioral/types.js'
import type { TemplateObject, Attrs, FunctionTemplate } from '../jsx/types.js'
import type { UseWorker } from '../utils-worker/types.js'
import type { UseEmit } from '../shared/use-emit.js'
import { PLAITED_COMPONENT_TYPE, PLAITED_MODULE_TYPE } from '../shared/constants.js'
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

export type ConnectArgs = [ReturnType<UseWorker>] | [string, ReturnType<UsePublisher>]

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

export type PublishToSocket = <T = unknown>(address: string) => (event: BPEvent<T>) => void
export type SubscribeToSocket = (address: string, trigger: Trigger) => Disconnect

export type UseSocket = {
  (url?: string | URL, protocols?: string | string[]): [PublishToSocket, SubscribeToSocket]
}

export type UseAjax = (shadowRoot: ShadowRoot) => Disconnect

export type UsePublisher = {
  (): {
    <T = unknown>(value?: T): void
    sub: (type: string, trigger: Trigger) => () => void
  }
}


type ComponentBProps = {
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

type ComponentBPMethod = (this: PlaitedElement, props: ComponentBProps) => Actions

type ModuleBProps = {
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
  socket: PublishToSocket
} & Omit<ReturnType<BProgram>, 'feedback'>

type ModuleBPMethod = (this: PlaitedElement, props: ModuleBProps) => Actions


type PlaitedElementArgs<T> = {
  tag: `${string}-${string}`
  /** Component template */
  template: TemplateObject
  /** observed Attributes that will trigger the native `attributeChangedCallback` method when modified*/
  observedAttributes?: string[]
  /** observed triggers that can be fired from outside component by invoking `trigger` method directly, via messenger, or via publisher */
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
  bp: T
}


export type GetPlaitedElement = (args:PlaitedElementArgs<ComponentBPMethod | ModuleBPMethod> & {
  useAjax?: UseAjax
  publish?:  PublishToSocket
  subscribe?: SubscribeToSocket
  address?: string
  mode: 'open' | 'closed'
  delegatesFocus: boolean
}) => void

export type ComponentTemplate<T extends Attrs = Attrs> = FunctionTemplate<T> & {
  registry: Set<string>
  tag: `${string}-${string}`
  type: typeof PLAITED_COMPONENT_TYPE
}

export type ModuleTemplate<T extends Attrs = Attrs> = FunctionTemplate<T> & {
  registry: Set<string>
  tag: `${string}-${string}`
  type: typeof PLAITED_MODULE_TYPE
}


export type ComponentArgs = PlaitedElementArgs<ComponentBPMethod> & {
mode?: 'open' | 'closed'
delegatesFocus?: boolean
}

export type ModuleArgs = PlaitedElementArgs<ModuleBPMethod> & {
  address: string
  mode?: 'open' | 'closed'
  delegatesFocus?: boolean
}




