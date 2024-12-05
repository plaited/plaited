import type { Trigger, Disconnect } from '../behavioral/b-program.js'
import type { PlaitedTrigger } from '../behavioral/get-plaited-trigger.js'
import type { CustomElementTag, FunctionTemplate } from '../jsx/jsx.types.js'
import { PLAITED_TEMPLATE_IDENTIFIER } from './plaited.constants.js'

export type { Position, SelectorMatch, CloneCallback } from './get-query.js'

export type Effect = (eventType: string, trigger: Trigger | PlaitedTrigger, getLVC?: boolean) => Disconnect

export interface PlaitedElement extends HTMLElement {
  // Custom Methods and properties
  trigger: Trigger
  readonly publicEvents?: string[]
  adoptedCallback?: { (this: PlaitedElement): void }
  attributeChangedCallback?: {
    (this: PlaitedElement, name: string, oldValue: string | null, newValue: string | null): void
  }
  connectedCallback(this: PlaitedElement): void
  disconnectedCallback(this: PlaitedElement): void
  formAssociatedCallback(this: PlaitedElement, form: HTMLFormElement): void
  formDisabledCallback(this: PlaitedElement, disabled: boolean): void
  formResetCallback(this: PlaitedElement): void
  formStateRestoreCallback(this: PlaitedElement, state: unknown, reason: 'autocomplete' | 'restore'): void
}

export type PlaitedTemplate = FunctionTemplate & {
  registry: Set<string>
  tag: CustomElementTag
  observedAttributes: string[]
  publicEvents: string[]
  $: typeof PLAITED_TEMPLATE_IDENTIFIER
}

export type JSONDetail = string | number | boolean | null | JsonObject | JsonArray

type JsonObject = {
  [key: string]: JSONDetail
}

type JsonArray = Array<JSONDetail>

export type PlaitedMessage<D extends JSONDetail = JSONDetail> = {
  address: string
  type: string
  detail?: D
}

export type Send = {
  <T extends PlaitedMessage>(message: T): void
  connect: (host: PlaitedElement) => () => void
}
