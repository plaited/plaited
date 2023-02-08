import { CustomElementTag, Template, TemplateProps } from '../island/mod.ts'
import { Expect, Page } from '../deps.ts'
import {
  Credentials,
  ErrorHandler,
  Routes,
  UnknownMethodHandler,
  UpdateRoutes,
} from '../server/mod.ts'

// Internal Mod Exports
export type StoryData = {
  args: TemplateProps
  name: string
  template: Template
  island?: CustomElementTag
}

export type StoriesData = [{ title: string; path: string }, StoryData[]][]

export type PageFunc = (args: {
  head: string
  body: string
}) => string

export type Ext = {
  island: string | string[]
  story: string | string[]
}

export type Write = (args: {
  assets: string
  colorScheme?: boolean
  dev: boolean
  exts: Ext
  importMapURL?: string | undefined
  page: PageFunc
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

// External Mod Exports

export type StoryConfig<T extends TemplateProps> = {
  title: string
  template: Template<T>
  island?: CustomElementTag
  description: string
}

export type Story<T extends TemplateProps> = {
  args: T & TemplateProps
  description: string
  play?: (args: { page: Page; expect: Expect; id: string }) => Promise<void>
}

export type GetStoryHandlers = (args: {
  storiesData: StoriesData
  registries: string[]
  page: PageFunc
  assets: string
}) => Routes

export type WorkshopConfig = {
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
  page: PageFunc
  unknownMethodHandler?: UnknownMethodHandler
}

export type WorkshopSetupConfig = {
  credentials?: Credentials
  pat?: boolean
  playwright: string
  port: number
  project?: string
}
