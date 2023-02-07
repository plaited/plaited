import { CustomElementTag, Template, TemplateProps } from '../island/mod.ts'
import { Expect, Page } from '../deps.ts'
import {
  Credentials,
  ErrorHandler,
  Handler,
  UnknownMethodHandler,
  UpdateRoutes,
} from '../server/mod.ts'

// Internal Mod Exports
export type StoryData = {
  args: TemplateProps
  name: string
  template: Template
  island: CustomElementTag
}

export type StoriesData = [{ title: string; path: string }, StoryData[]][]

export type PageFunc = (story: string) => string
export type SSRFunc = (
  island: CustomElementTag,
  template: string,
) => string
export type Ext = {
  island: string | string[]
  story: string | string[]
}

export type Write = (args: {
  assets: string
  colorScheme?: boolean
  exts: Ext
  port: number
  project?: string
  root: string
  storyHandlers: StoryHandlers
  playwright: string
}) => Promise<Record<string, Handler>>

export type Watcher = (
  args: Parameters<Write>[0] & {
    root: string
    updateRoutes: UpdateRoutes
  },
) => Promise<void>

// External Mod Exports

export type StoryConfig<T extends TemplateProps> = {
  title: string
  template: Template<T>
  island: CustomElementTag
  description: string
}

export type Story<T extends TemplateProps> = {
  args: T & TemplateProps
  description: string
  play?: (args: { page: Page; expect: Expect; id: string }) => Promise<void>
}

export type StoryHandlers = (stories: StoriesData) => Record<string, Handler>

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
  storyHandlers: StoryHandlers
  unknownMethodHandler?: UnknownMethodHandler
}

export type WorkshopSetupConfig = {
  credentials?: Credentials
  pat?: boolean
  playwright: string
  port: number
  project?: string
}
