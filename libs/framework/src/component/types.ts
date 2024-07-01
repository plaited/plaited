import type { Actions, BProgram, Trigger, BPEvent } from '../behavioral/types.js'
import type { TemplateObject, Attrs, FunctionTemplate } from '../jsx/types.js'
import type { UseSocket, UseWorker, UsePublisher, Disconnect } from '../utils/types.js'

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

export type UseEmit = (host: HTMLElement) => (
  args: BPEvent & {
    bubbles?: boolean
    cancelable?: boolean
    composed?: boolean
  },
) => void

export type ConnectArgs = [ReturnType<UseWorker>] | [ReturnType<UseSocket>] | [string, ReturnType<UsePublisher>]

/** Clone feature for handling list situations where structure is consistent but the data rendered is what is different. This is a performance feature */
export type UseClone = (
  shadowRoot: ShadowRoot,
) => <T>(template: TemplateObject, callback: ($: QuerySelector, data: T) => void) => (data: T) => DocumentFragment

export type BProps = {
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

export type GetPlaitedElement = {
  (): PlaitedElementConstructor
  tag: `${string}-${string}`
}

export type PlaitedTemplate<T extends Attrs = Attrs> = FunctionTemplate<T> & {
  define: (silent?: boolean) => void
  tag: `${string}-${string}`
  $: '🐻'
}

type BPFunction = (this: PlaitedElement, props: BProps) => Actions
export type PlaitedComponent = <T extends Attrs = Attrs>(args: {
  /** PlaitedComponent tag name */
  tag: `${string}-${string}`
  /** Component template */
  template: TemplateObject
  /** observed Attributes that will trigger the native `attributeChangedCallback` method when modified*/
  observedAttributes?: string[]
  /** observed triggers that can be fired from outside component by invoking `trigger` method directly, via messenger, or via publisher */
  publicEvents?: string[]
  /** define wether island's custom element is open or closed. @defaultValue 'open'*/
  mode?: 'open' | 'closed'
  /** configure whether to delegate focus or not @defaultValue 'true' */
  delegatesFocus?: boolean
  bp?: BPFunction
  connectedCallback?(this: PlaitedElement): void
  attributeChangedCallback?(this: PlaitedElement, name: string, oldValue: string | null, newValue: string | null): void
  disconnectedCallback?(this: PlaitedElement): void
  adoptedCallback?(this: PlaitedElement): void
  formAssociatedCallback?(this: PlaitedElement, form: HTMLFormElement): void
  formDisabledCallback?(this: PlaitedElement, disabled: boolean): void
  formResetCallback?(this: PlaitedElement): void
  formStateRestoreCallback?(this: PlaitedElement, state: unknown, reason: 'autocomplete' | 'restore'): void
}) => PlaitedTemplate<T>

export type HDAHook = (shadowRoot: ShadowRoot) => () => void
