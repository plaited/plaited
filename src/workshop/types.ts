import { Template, TemplateProps } from '../template/mod.ts'
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
  fixture: `${string}-${string}`
}

export type StoriesData = [{ title: string; path: string }, StoryData[]][]

export type PageFunc = (story: string) => string
export type SSRFunc = (
  fixture: `${string}-${string}`,
  template: string,
) => string
export type Ext = {
  fixture: string | string[]
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

export type StoryConfig<T extends TemplateProps = TemplateProps> = {
  title: string
  template: Template<T>
  fixture: `${string}-${string}`
  description: string
  insertHead?: string
  insertBody?: string
}

export type Story<T extends TemplateProps = TemplateProps> = {
  args: T
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
