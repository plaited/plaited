import { bProgram, DevCallback, Strategy, Trigger, TriggerArgs } from '@plaited/behavioral'
import { Template, FunctionTemplate } from '@plaited/jsx'

export type Send = (recipient: string, detail: TriggerArgs) => void

export interface Messenger extends Send {
  connect: (recipient: string, trigger: Trigger | Worker) => undefined | (() => void)
  has: (recipient: string) => boolean
}

export type Message = {
  recipient: string
  detail: TriggerArgs
}

export type Position = 'beforebegin' | 'afterbegin' | 'beforeend' | 'afterend'

export type SelectorMatch = '=' | '~=' | '|=' | '^=' | '$=' | '*='

export interface $ {
  <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
    target: string,
    /** This options enables querySelectorAll and modified the attribute selector for data-target{@default {all: false, mod: "=" } } {@link https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors#syntax}*/
    match?: SelectorMatch,
  ): SugaredElement<T>[]
}

export type Sugar = {
  render(this: HTMLElement | SVGElement, template: Template): void
  insert(this: HTMLElement | SVGElement, position: Position, template: Template): void
  replace(this: HTMLElement | SVGElement, template: Template): void
  attr(this: HTMLElement | SVGElement, attr: Record<string, string | null | number | boolean>, val?: never): void
  attr(this: HTMLElement | SVGElement, attr: string, val?: string | null | number | boolean): string | null | void
}

export type SugaredElement<T extends HTMLElement | SVGElement = HTMLElement | SVGElement> = T & Sugar

export type Emit = (
  args: TriggerArgs & {
    bubbles?: boolean
    cancelable?: boolean
    composed?: boolean
  },
) => void

export type Publisher<T extends TriggerArgs = TriggerArgs> = {
  (value: T): void
  subscribe(listener: (msg: T) => void): () => boolean
}

export type PlaitProps = {
  /** query for elements with the data-target attribute in the Island's shadowDom and slots */
  $: $
  /** The DOM node context allowing easy light & shadow dom access
   * @example
   * // returns the div element inside
   * // the shadowRoot of the element instance
   * const shadowEl = host.shadowRoot.querySelector('div')
   */
  host: PlaitedElement
  emit: Emit
  connect: (comm: Publisher | Messenger) => () => void
} & ReturnType<typeof bProgram>

export interface PlaitedElement extends HTMLElement {
  internals_: ElementInternals
  plait?(props: PlaitProps): void | Promise<void>
  trigger: Trigger
  $: $
  connectedCallback?(): void
  attributeChangedCallback?(name: string, oldValue: string | null, newValue: string | null): void
  disconnectedCallback?(): void
  adoptedCallback?(): void
  formAssociatedCallback?(form: HTMLFormElement): void
  formDisabledCallback?(disabled: boolean): void
  formResetCallback?(): void
  formStateRestoreCallback?(state: unknown, reason: 'autocomplete' | 'restore'): void
}

export interface PlaitedComponentConstructor {
  stylesheets: Set<string>
  tag: string
  template: FunctionTemplate
  new (): PlaitedElement
}

export type ComponentFunction = (args: {
  /** PlaitedComponent tag name */
  tag: `${string}-${string}`
  /** Optional Plaited Component shadow dom template*/
  template: Template
  /** define wether island's custom element is open or closed. @defaultValue 'open'*/
  mode?: 'open' | 'closed'
  /** configure whether to delegate focus or not @defaultValue 'true' */
  delegatesFocus?: boolean
  /** logger function to receive messages from behavioral program react streams */
  dev?: true | DevCallback
  /** event selection strategy callback from behavioral library */
  strategy?: Strategy
  /** Triggers that can be fired from outside component by invoking trigger method directly, via messenger, or via publisher */
  observedTriggers?: Array<string>
}) => PlaitedComponentConstructor
