import type { Trigger, Disconnect } from '../behavioral/b-program.js'

export type PlaitedTrigger = Trigger & {
  addDisconnectCallback: (disconnect: Disconnect) => void
}

export type Effect = (eventType: string, trigger: Trigger | PlaitedTrigger, getLVC?: boolean) => Disconnect

export interface PlaitedElement extends HTMLElement {
  // Custom Methods and properties
  trigger: PlaitedTrigger
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
