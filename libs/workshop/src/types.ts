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
  play: Parameters<typeof test>[1]
}

export type Config = {
  tokens?: DesignTokenGroup
  assets?: string
  output?: string
  port?: number
}
