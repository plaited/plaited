import { TemplateProps, Template } from '@plaited/template'
import { Page } from 'playwright'
import { Expect } from '@playwright/test'

export type TemplateMeta<T extends TemplateProps= TemplateProps> = {
  title: string
  template:Template<T> 
  fixture: `${string}-${string}`
  templateArgs?: T
  hookArgs?: Record<string, unknown>
  play?: (args: { page: Page, expect: Expect, id: string }) => Promise<void>
}

export type TemplateWork<T extends TemplateProps= TemplateProps> = {
  title?: string
  template?:Template<T> 
  fixture?: `${string}-${string}`
  templateArgs: T
  hookArgs?: Record<string, unknown>
  play?: (args: { page: Page, expect: Expect, id: string }) => Promise<void>
}
