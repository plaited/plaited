import { CustomElementTag, Template, TemplateProps } from '../island/mod.ts'
import { Expect, Page } from '../deps.ts'
import {
  Credentials,
  ErrorHandler,
  Routes,
  UnknownMethodHandler,
  UpdateRoutes,
} from '../server/mod.ts'

export type StoryConfig<T extends TemplateProps = TemplateProps> = {
  title: string
  template: Template<T>
  island?: CustomElementTag
  description: string
}

export type Story<T extends TemplateProps = TemplateProps> = {
  args: T & TemplateProps
  description: string
  play?: (args: { page: Page; expect: Expect; id: string }) => Promise<void>
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
  registries: string[]
  assets: string
  dev: boolean
  includes?: {
    head?: string
    body?: string
  }
}) => Routes

export type Ext = {
  island: string | string[]
  story: string | string[]
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
  args: Parameters<Write>[0] & {
    updateRoutes: UpdateRoutes
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
