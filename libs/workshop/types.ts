import { Template, TemplateProps } from '../islandly/mod.ts'
import { Expect, Locator } from './deps.ts'
import {
  Credentials,
  ErrorHandler,
  Routes,
  UnknownMethodHandler,
} from '../server/mod.ts'

export type StoryConfig<T extends TemplateProps = TemplateProps> = {
  title: string
  template: Template<T>
  description: string
}

export type Story<T extends TemplateProps = TemplateProps> = {
  args: T & TemplateProps
  description: string
  test?: (
    args: { locator: Locator; expect: Expect; id: string },
  ) => Promise<void>
}

export type StoryData = Story & {
  name: string
}

export type StoriesData = [
  {
    path: string
  } & StoryConfig,
  StoryData[],
][]

export type GetStoryHandlers = (args: {
  storiesData: StoriesData
  entries: string[]
  assets: string
  dev: boolean
  includes?: {
    head?: string
    body?: string
  }
}) => Routes

export type Ext = {
  worker?: `.${string}.ts` | `.${string}.ts`[]
  island: `.${string}.ts` | `.${string}.ts`[]
  story: `.${string}.ts` | `.${string}.ts`[]
}

export type Write = (args: {
  assets: string
  colorScheme?: boolean
  dev: boolean
  exts: Ext
  importMap?: URL
  includes?: {
    head?: string
    body?: string
  }
  playwright: string
  port: number
  project?: string
  root: string
}) => Promise<Routes>

export type Watcher = (
  args: {
    root: string
    ref: { close: () => Promise<void> }
    startServer: () => Promise<void>
  },
) => Promise<void>

export type WorkshopConfig = {
  importMap?: string
  assets: string
  colorScheme?: boolean
  credentials?: Credentials
  dev?: boolean
  errorHandler?: ErrorHandler
  exts: Ext
  notFoundTemplate?: string
  pat?: boolean
  playwright: string
  port: number
  project?: string
  root: string
  includes?: {
    head?: string
    body?: string
  }
  unknownMethodHandler?: UnknownMethodHandler
}

export type WorkshopSetupConfig = {
  credentials?: Credentials
  pat?: boolean
  playwright: string
  port: number
  project?: string
}
