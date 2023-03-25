import { Assertion } from '$assert'
import { Template, TemplateProps } from '$plaited'

export type TestCallback = (
  t: Assertion,
  context: HTMLBodyElement,
) => Promise<void> | void

export type StorySet<T extends TemplateProps = TemplateProps> = {
  title: string
  template: Template<T>
  description: string
}

export type Story<T extends TemplateProps = TemplateProps> = {
  args?: T & TemplateProps
  description: string
  test?: TestCallback
}

export type StoryData = Story & {
  name: string
}

export type StorySetData = [
  {
    path: string
  } & StorySet,
  StoryData[],
][]
