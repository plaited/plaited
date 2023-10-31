import { bProgram, DevCallback, Strategy, Trigger, TriggerArgs } from '@plaited/behavioral'
import { SugaredElement } from './sugar.js'
import { Template, AdditionalAttrs, FunctionTemplate } from '@plaited/jsx'

export interface Connect {
  (recipient: string, trigger: Trigger): undefined | (() => void)
  worker: (id: string, worker: Worker) => undefined | (() => void)
}
export type Send = (recipient: string, detail: TriggerArgs) => void
export type Message = {
  recipient: string
  detail: TriggerArgs
}

export type SelectorMod = '=' | '~=' | '|=' | '^=' | '$=' | '*='

export interface $ {
  <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
    target: string,
    opts?: {
      all?: false
      mod?: SelectorMod
    },
  ): SugaredElement<T> | undefined
  <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
    target: string,
    /** This options enables querySelectorAll and modified the attribute selector for data-target{@default {all: false, mod: "=" } } {@link https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors#syntax}*/
    opts?: {
      all: true
      mod?: SelectorMod
    },
  ): SugaredElement<T>[]
}

export interface PlaitedElement extends HTMLElement {
  internals_: ElementInternals
  plait?(props: PlaitProps): void | Promise<void>
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
} & ReturnType<typeof bProgram>

export interface PlaitedElementConstructor {
  stylesheets: Set<string>
  tag: string
  template: FunctionTemplate<AdditionalAttrs & { slots: never }>
  new (): PlaitedElement
}

export type ComponentArgs = {
  /** PlaitedComponent tag name */
  tag: `${string}-${string}`
  /** Optional Plaited Component shadow dom template*/
  template: Template
  /** Messenger connect callback from useMessenger */
  connect?: Connect
  /** define wether island's custom element is open or closed. @defaultValue 'open'*/
  mode?: 'open' | 'closed'
  /** configure whether to delegate focus or not @defaultValue 'true' */
  delegatesFocus?: boolean
  /** logger function to receive messages from behavioral program react streams */
  dev?: true | DevCallback
  /** event selection strategy callback from behavioral library */
  strategy?: Strategy
  /** the element tag you want to use */
  observedTriggers?: Record<string, string>
}
