import { bProgram, DevCallback, Strategy, Trigger } from '../behavioral/mod.ts'
import { SugaredElement } from './use-sugar.ts'
export type Primitive =
  | null
  | undefined
  | number
  | string
  | boolean
  | bigint

export type ISLElementOptions = {
  /** define wether island's custom element is open or closed. @defaultValue 'open'*/
  mode?: 'open' | 'closed'
  /** configure whether to delegate focus or not @defaultValue 'true' */
  delegatesFocus?: boolean
  /** logger function to receive messages from behavioral program react streams */
  dev?: DevCallback
  /** event selection strategy callback from behavioral library */
  strategy?: Strategy
  /** messenger connect callback */
  connect?: (recipient: string, trigger: Trigger) => () => void
  /** set to true if we wish to use id when connecting to messenger to receive messages from other islands */
  id?: boolean
  /** the element tag you want to use */
  tag: `${string}-${string}`
}

export type PlaitProps = {
  /** query for elements with the data-target attribute in the Island's shadowDom and slots */
  $<T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
    target: string,
  ): SugaredElement<T> | undefined
  $<T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
    target: string,
    all: true,
  ): SugaredElement<T>[]
  /** The DOM node context allowing easy light & shadow dom access
   * @example
   * // returns the div element inside
   * // the shadowRoot of the element instance
   * const shadowEl = context.shadowRoot.querySelector('div')
   */
  context: ISLElement
} & ReturnType<typeof bProgram>

export interface ISLElement extends HTMLElement {
  plait?(props: PlaitProps): void | Promise<void>
  connectedCallback?(): void
  attributeChangedCallback?(
    name: string,
    oldValue: string | null,
    newValue: string | null,
  ): void
  disconnectedCallback?(): void
  adoptedCallback?(): void
  formAssociatedCallback?(form: HTMLFormElement): void
  formDisabledCallback?(disabled: boolean): void
  formResetCallback?(): void
  formStateRestoreCallback?(
    state: unknown,
    reason: 'autocomplete' | 'restore',
  ): void
}

export interface ISLElementConstructor {
  new (): ISLElement
}
