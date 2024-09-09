import { Attrs, FunctionTemplate } from '../jsx/jsx.types.js';
import type { RuleObject } from './types/axe.d.ts';
import type { Play } from './use-play.js';

export type Parameters = {
  a11y?: RuleObject // Defaults to true
  description: string // Defaults to undefined
  timeout?: number // Defaults to 5_000 ms
}

export type BaseStory<T extends Attrs = Attrs> = {
  play?: Play
  attrs?: T
  parameters?: Parameters
}

export type ModuleStory<T extends Attrs = Attrs> = {
  location: URL
} & BaseStory<T>

export type TemplateStory<T extends Attrs = Attrs> = {
  render: FunctionTemplate<T>
} & BaseStory<T>

export type StoryObj<T extends Attrs = Attrs> = TemplateStory<T> | ModuleStory<T>

// export type ComposeStories = {
//   (stories: Record<string, StoryObj>): [string, Parameters][]
//   extend(root: string): (stories: Record<string, StoriesExport>) => [string, Parameters][]
// }
