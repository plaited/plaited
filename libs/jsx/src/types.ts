import { dataAddress, dataTarget, dataTrigger } from './constants.js'
/* eslint-disable @typescript-eslint/no-explicit-any */
export type Primitive = null | undefined | number | string | boolean | bigint

export type Template = {
  content: string
  string: string
  stylesheets: Set<string>
}

export type Child = string | Template

export type Children = Child[] | Child

export interface AdditionalAttrs {
  [key: string]: Primitive | Children | Record<string, string>
}

export type BaseAttrs = {
  class?: never
  for?: never
  dataAddress?: string
  dataTarget?: string
  dataTrigger?: Record<string, string>
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

export type Attrs<T extends AdditionalAttrs = AdditionalAttrs> = BaseAttrs & T

export type FunctionTemplate<T extends Record<string, any> = Record<string, any>> = (attrs: T & BaseAttrs) => Template

export type FT<
  //Alias for FunctionTemplate
  T extends Record<string, any> = Record<string, any>,
> = FunctionTemplate<T>

export type Tag = string | `${string}-${string}` | FT

export interface CreateTemplate {
  <T extends AdditionalAttrs>(tag: Tag, attrs: Attrs<T>): Template
}
