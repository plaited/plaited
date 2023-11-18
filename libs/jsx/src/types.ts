import { dataAddress, dataTarget, dataTrigger } from './constants.js'
/* eslint-disable @typescript-eslint/no-explicit-any */
export type Primitive = null | undefined | number | string | boolean | bigint

export type TemplateObject = {
  client: string[]
  server: string[]
  stylesheets: Set<string>
}

export type Child = string | TemplateObject

export type Children = Child[] | Child

export type BaseAttrs = {
  class?: never
  for?: never
  [dataAddress]?: string
  [dataTarget]?: string
  [dataTrigger]?: Record<string, string>
  htmlFor?: string
  className?: string
  children?: Children
  key?: string
  shadowrootmode?: 'open' | 'closed' // TODO need to figure out conditional type maybe???
  shadowrootdelegatesfocus?: boolean // TODO need to figure out conditional type maybe???
  stylesheet?: string | string[]
  /** setting trusted to true will disable all escaping security policy measures for this element template */
  trusted?: boolean
  style?: Record<string, string>
}

export type Attrs<T extends Record<string, any> = Record<string, any>> = BaseAttrs & T

export type FunctionTemplate<T extends Record<string, any> = Record<string, any>> = (
  attrs: T & BaseAttrs,
) => TemplateObject

export type FT<
  //Alias for FunctionTemplate
  T extends Record<string, any> = Record<string, any>,
> = FunctionTemplate<T>

export type Tag = string | `${string}-${string}` | FT

export interface CreateTemplate {
  <T extends Record<string, any>>(tag: Tag, attrs: Attrs<T>): TemplateObject
}
