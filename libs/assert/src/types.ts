export interface AssertionErrorInterface extends Error {
  name: string
}

export interface AssertionErrorConstructor {
  new (message: string): AssertionErrorInterface
}

export type Assert = <T>(param: { given: string; should: string; actual: T; expected: T }) => void
export type EventArguments = {
  bubbles?: boolean
  composed?: boolean
  cancelable?: boolean
  detail?: Record<string, unknown>
}
export type FindByAttribute = <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
  attributeName: string,
  attributeValue: string | RegExp,
  context?: HTMLElement | SVGElement,
) => Promise<T | undefined>
export type FindByText = <T extends HTMLElement = HTMLElement>(
  searchText: string | RegExp,
  context?: HTMLElement,
) => Promise<T | undefined>
export type FireEvent = <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
  element: T,
  eventName: string,
  options?: EventArguments,
) => Promise<void>
export type Match = (str: string) => (pattern: string | RegExp) => string
export type Throws = <U extends unknown[], V>(
  fn: (...args: U) => V,
  ...args: U
) => string | undefined | Promise<string | undefined>
export type Wait = (ms: number) => Promise<unknown>
