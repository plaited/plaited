import {
  Feedback,
  Listener,
  RulesFunc,
  Strategy,
  Trigger,
} from '../plait/mod.ts'

/**
 * @description returns a an array of nodes who's data-target value is the same as the target string provided.
 */
export type Query = <T = Element>(target: string) => T[] | never[]

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
  mode?: 'open' | 'closed'
  delegatesFocus?: boolean
  logger?: Listener
  strategy?: Strategy
  connect?: (recipient: string, trigger: Trigger) => () => void
  id?: string
}

export interface PlaitInterface {
  (args: {
    $: Query
    context: ISLElement // should we call this element or context?
    add: (logicStands: Record<string, RulesFunc>) => void
    feedback: Feedback
    trigger: Trigger
    lastEvent: () => {
      type: string
      data: unknown
    }
  }): void
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
