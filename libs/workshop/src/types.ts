import { Attrs, PlaitedElement, isle } from 'plaited'
import {  test } from '@playwright/test'
import { DesignTokenGroup } from '@plaited/token-types'
export type Meta<T extends Attrs = Attrs> = {
  title: string,
  description: string
  template: PlaitedElement<T>
  define?: ReturnType<typeof isle>
}

export type Story<T extends Attrs = Attrs>  = {
  attrs: T
  description: string
  play?: Parameters<typeof test>[1]
}

export type StoryData =   Story & Pick<Meta, 'title' | 'template'>  & {
  name: string,
  storyPath: string
  testPath: string
}

export type StoryMap = Map<string, StoryData>

export type Config = {
  /** Design system token group object*/
  tokens?: DesignTokenGroup
  /** Static file assets to serve */
  assets?: string
  /** Where to output tests and token schema */
  tests?: string
  /** Whether to output design token json schema */
  schema?: boolean
  /** Port to run dev server on */
  port?: number
  /** Where to output transformed tokens */
  output?: string
  /** glob pattern of where component stories are */
  stories: string
  /** live reload on */
  reload?: boolean
}

export type Bundles = Map<string, Uint8Array>
export type SetRoutes = (bundles: Bundles) => Promise<undefined>
