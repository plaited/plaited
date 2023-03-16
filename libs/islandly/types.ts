import {
  bProgram,
  Logger,
  RulesFunc,
  Strategy,
  Trigger,
} from '../behavioral/mod.ts'

/**
 * @description returns a an array of nodes who's data-target value is the same as the target string provided.
 */
export type Query = <T extends (HTMLElement | SVGElement)>(
  target: string,
) => T[] | never[]

export type UseHook<T = Record<string, unknown>> = (
  args: {
    $: Query
  } & T,
) => {
  actions: Record<string, (data: unknown) => void>
  strands: Record<string, RulesFunc>
}

export type CustomElementTag = `${string}-${string}`

export type IslandElementOptions = {
  /** define wether island's custom element is open or closed. Defaults to open and can be overridden
   * by declarative shadow dom attribute in browsers that support it so be ware
   */
  mode?: 'open' | 'closed'
  /** configure whether to delegate focus or not defaults to true */
  delegatesFocus?: boolean
  /** logger function to receive messages from behavioral program react streams */
  logger?: Logger
  /** event selection strategy callback from behavioral library */
  strategy?: Strategy
  /** messenger connect callback */
  connect?: (recipient: string, trigger: Trigger) => () => void
  /** set to true if we wish to use id when connecting to messenger to receive messages from other islands */
  id?: boolean
  /** constructable stylesheets - aka a set of style selectors and rules as strings */
  styles?: string | string[]
}

export interface PlaitInterface {
  (
    args: {
      /** query for elements with the data-target attribute in the Island's shadowDom and slots */
      $: Query
      /** The DOM node context allowing easy light & shadow dom access
       * @example
       * // returns the div element inside
       * // the shadowRoot of the element instance
       * const shadowEl = context.shadowRoot.querySelector('div')
       */
      context: ISLElement
    } & ReturnType<typeof bProgram>,
  ): void | Promise<void>
}

export interface ISLElement extends HTMLElement {
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
  plait: PlaitInterface
}

export interface IslandElementConstructor {
  // deno-lint-ignore no-explicit-any
  new (...args: any[]): ISLElement
}

export interface IslandConfig extends IslandElementOptions {
  tag: CustomElementTag
}

export type Primitive =
  | number
  | string
  | boolean
  | undefined
  | null
  | void
