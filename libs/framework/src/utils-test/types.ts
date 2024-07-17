import type { Attrs, FunctionTemplate } from '../jsx/types.js'
import type { PlaitedTemplate } from '../client/types.js'
import type axe from 'axe-core'

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

export type Play = (args: {
  assert: Assert
  findByAttribute: FindByAttribute
  findByText: FindByText
  fireEvent: FireEvent
  match: Match
  throws: Throws
  wait: Wait
}) => Promise<void> | void

export type Parameters =  {
  a11y?: axe.RuleObject // Defaults to true
  timeout?: number // Defaults to 5_000 ms
  description?: string // Defaults to undefined
}

export type Meta<T extends Attrs = Attrs> = {
  title?: string
  attrs?: T
  parameters?: Parameters
}

export type StoryObj<T extends Attrs | Meta = Attrs> = {
  render: FunctionTemplate<T> | PlaitedTemplate<T>
  play?: Play
  attrs?: T extends Attrs ? T : T extends Meta ? T['attrs'] : Attrs
  parameters?: Parameters
}

export type StoriesExport = Meta | StoryObj

export type ComposeStories = {
  (stories: Record<string, StoriesExport>): [string, Parameters][];
  extend(root: string): (stories: Record<string, StoriesExport>) => [string, Parameters][];
}