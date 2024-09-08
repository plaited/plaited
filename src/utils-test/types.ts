import type { Attrs, FunctionTemplate } from '../jsx/types.js'
import type { PlaitedTemplate } from '../client/types.js'
import type axe from 'axe-core'


export type Play = (args: {
  assert: Assert
  findByAttribute: FindByAttribute
  findByText: FindByText
  fireEvent: FireEvent
  match: Match
  throws: Throws
  wait: Wait
}) => Promise<void> | void

export type Parameters = {
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
  attrs?: T extends Attrs ? T
  : T extends Meta ? T['attrs']
  : Attrs
  parameters?: Parameters
}

export type StoriesExport = Meta | StoryObj

export type ComposeStories = {
  (stories: Record<string, StoriesExport>): [string, Parameters][]
  extend(root: string): (stories: Record<string, StoriesExport>) => [string, Parameters][]
}
