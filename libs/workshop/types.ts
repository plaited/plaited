import { Template, TemplateProps } from '../islandly/mod.ts'
import { Credentials, Routes } from '../server/mod.ts'

export type StoryConfig<T extends TemplateProps = TemplateProps> = {
  title: string
  template: Template<T>
  description: string
}

export type Story<T extends TemplateProps = TemplateProps> = {
  args?: T & TemplateProps
  description: string
  play?: (context: ShadowRoot) => Promise<void> | void
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

export type GetRoutes = (args: {
  assets: string
  clientEntries: string[]
  dev: boolean
  runnerEntry: string[]
  exts: Ext
  includes?: {
    head?: string
    body?: string
  }
  project?: string
  storyModules: string[]
}) => Promise<Routes>

export type Write = (args: {
  assets: string
  dev: boolean
  exts: Ext
  importMap?: URL
  workspace: string
}) => Promise<{
  clientEntries: string[]
  runnerEntry: string[]
  storyModules: string[]
}>

export type Watcher = (
  args: {
    assets: string
    dev: boolean
    exts: Ext
    getRoutes: GetRoutes
    includes?: {
      head?: string
      body?: string
    }
    project?: string
    routes: Routes
    workspace: string
    writeFn: () => Promise<{
      clientEntries: string[]
      runnerEntry: string[]
      storyModules: string[]
    }>
  },
) => Promise<void>

export type WorkshopConfig = {
  assets?: string
  credentials?: Credentials
  dev?: boolean
  exts?: Ext
  importMap?: string
  includes?: {
    head?: string
    body?: string
  }
  port?: number
  project?: string
  workspace?: string
}
