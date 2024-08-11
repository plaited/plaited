import type { Rules, Trigger, Actions, Snapshot, Sync, Loop, Thread, BPEvent  } from '../behavioral/types.js'
import type { TemplateObject, Attrs, FunctionTemplate, CustomElementTag } from '../jsx/types.js'
import type { PLAITED_COMPONENT_IDENTIFIER } from '../shared/constants.js'
import type { Disconnect } from '../shared/types.js'

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
    /** This options enables querySelectorAll and modified the attribute selector for bp-target{@default {all: false, mod: "=" } } {@link https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors#syntax}*/
    match?: SelectorMatch,
  ): BoundElement<T>[]
}

export type Clone = <T>(template: TemplateObject, callback: ($: QuerySelector, data: T) => void) => (data: T) => DocumentFragment

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
  addDisconnectedCallback(callback: Disconnect): void
  readonly publicEvents?: string[]
  // Default Methods and Properties
  internals_: ElementInternals
  adoptedCallback?:{(this: PlaitedElement): void}
  attributeChangedCallback?:{(this: PlaitedElement, name: string, oldValue: string | null, newValue: string | null): void}
  connectedCallback(this: PlaitedElement): void
  disconnectedCallback(this: PlaitedElement): void
  formAssociatedCallback?:{(this: PlaitedElement, form: HTMLFormElement): void}
  formDisabledCallback?:{(this: PlaitedElement, disabled: boolean): void}
  formResetCallback?:{(this: PlaitedElement): void}
  formStateRestoreCallback?:{(this: PlaitedElement, state: unknown, reason: 'autocomplete' | 'restore'): void}
}

export interface PlaitedElementConstructor {
  new (): PlaitedElement
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
    (
      this: PlaitedElement,
      args: {
      $: QuerySelector
      host: PlaitedElement
      emit: Emit
      clone: Clone
      // Behavioral Program
      trigger: Trigger
      rules: Rules
      snapshot: Snapshot
      thread: Thread
      loop: Loop
      sync: Sync
    }
    ):Actions
  }
  adoptedCallback?:{(this: PlaitedElement): void}
  attributeChangedCallback?:{(this: PlaitedElement, name: string, oldValue: string | null, newValue: string | null): void}
  disconnectedCallback?:{(this: PlaitedElement): void}
  formAssociatedCallback?:{(this: PlaitedElement, form: HTMLFormElement): void}
  formDisabledCallback?:{(this: PlaitedElement, disabled: boolean): void}
  formResetCallback?:{(this: PlaitedElement): void}
  formStateRestoreCallback?:{(this: PlaitedElement, state: unknown, reason: 'autocomplete' | 'restore'): void}
}

export type PlaitedTemplate<T extends Attrs = Attrs> = FunctionTemplate<T> & {
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

export type SendSocketDetail = 
  | string
  | number
  | boolean
  | null
  | JsonObject
  | JsonArray

interface JsonObject {
  [key: string]: SendSocketDetail
}

interface JsonArray extends Array<SendSocketDetail> {}
