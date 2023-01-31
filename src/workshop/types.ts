import { TemplateProps, Template } from '../template.ts'
import { Page, Expect } from '../deps.ts'
import { Handler as ServerHandler } from '../server.ts'

export type ComponentConfig<T extends TemplateProps= TemplateProps> = {
  title: string
  template:Template<T> 
  fixture: `${string}-${string}`
  description: string
  insertHead?: string
  insertBody?: string
}

export type Stories<T extends TemplateProps= TemplateProps> = {
  args: T
  description: string,
  play?: (args: { page: Page, expect: Expect, id: string }) => Promise<void>
}

export type Handler = {
  page: ServerHandler
  include: ServerHandler
}

export type WorkshopConfig = {
  source: string
  workPattern: string
  fixturePattern: string
  tests: string
  port: number
  removeDeadTest?: boolean
  reload?: boolean
  assets?: string
}
