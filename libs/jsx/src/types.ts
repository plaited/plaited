/* eslint-disable @typescript-eslint/no-explicit-any */
export type Primitive =
  | null
  | undefined
  | number
  | string
  | boolean
  | bigint;

export type Template = {
  content: string;
  stylesheets: Set<string>;
};

export type Child = string | Template

export type Children = Child[] | Child;

export interface AdditionalAttrs {
    [key: string]: Primitive | Children | Record<string, string>;
}

export type BaseAttrs = {
  class?: never;
  for?: never;
  'data-target'?: string;
  'data-trigger'?: Record<string, string>;
  htmlFor?: string,
  className?: string,
  children?: Children
  key?: string;
  shadowrootmode?: 'open' | 'closed';
  shadowrootdelegatesfocus?: boolean;
  stylesheet?: string | string[];
  /** setting trusted to true will disable all escaping security policy measures for this element template */
  trusted?: boolean;
  slots?: Children;
  style?: Record<string, string>;
};



export type Attrs<
  T extends AdditionalAttrs = AdditionalAttrs,
> =
  & BaseAttrs
  & T;

export type PlaitedElement<
  T extends Record<string, any> = Record<
    string,
    any
  >,
> = (attrs: T & BaseAttrs) => Template;

type Tag = string | `${string}-${string}` | PlaitedElement;

export interface CreateTemplate {
  <T extends AdditionalAttrs>(
    tag: Tag,
    attrs: Attrs<T>,
  ): Template;
}
