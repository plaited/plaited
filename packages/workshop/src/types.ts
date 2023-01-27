import { TemplateProps, Template } from '@plaited/template'
import { Page } from 'playwright'
import { Expect } from '@playwright/test'
import { ServerResponse } from 'http'

export type WorksConfig<T extends TemplateProps= TemplateProps> = {
  title: string
  template:Template<T> 
  fixture: `${string}-${string}`
  description: string
  insertHead?: string
  insertBody?: string
}

export type WorkMeta<T extends TemplateProps= TemplateProps> = {
  args: T
  description: string,
  play?: (args: { page: Page, expect: Expect, id: string }) => Promise<void>
}

export type Handler = {
  page: (ctx: ServerResponse) => void
  include: (ctx: ServerResponse) => void
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
