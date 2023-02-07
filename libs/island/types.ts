import { RulesFunc, Trigger } from '../plait/mod.ts'

export type Query = <T = Element>(id: string) => T[]

export type UseHook<T = Record<string, unknown>> = (
  args: {
    $: Query
  } & T,
) => {
  actions: Record<string, (data: unknown) => void>
  strands: Record<string, RulesFunc>
}

export type CustomElementTag = `${string}-${string}`

interface IslandElement extends HTMLElement {
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
  plait($: Query): {
    trigger: Trigger
    disconnect: () => void
  }
}

export interface IslandElementConstructor {
  // deno-lint-ignore no-explicit-any
  new (...args: any[]): IslandElement
}
