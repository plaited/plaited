import type { FunctionTemplate, TemplateObject } from 'plaited'
import type {RunOptions} from 'axe-core'

type Options =  {
  a11y?:  RunOptions
  description?: string
}

type Render <T extends FunctionTemplate> = (attrs: Parameters<T>[0]) => TemplateObject
type Play = () => Promise<void> | void

export type StoryObj<T extends FunctionTemplate = FunctionTemplate> = {
  attrs: Parameters<T>[0],
  options?: Options
} & (
  | { render: Render<T>; play?: Play}
  | { play: Play; render?: Render<T> }
);
