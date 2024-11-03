import type * as CSS from './types/css.js'

export type CSSProperties = CSS.Properties<string | number> & {
  [key: string]: string | number
}

export type CreateNestedCSS<T extends keyof CSSProperties> = {
  default?: CSSProperties[T]
  [key: `@${'container' | 'layer' | 'media' | 'supports'}${string}`]: CSSProperties[T]
  [key: `:${string}`]: CSSProperties[T] | CreateNestedCSS<T>
  [key: `[${string}`]: CSSProperties[T] | CreateNestedCSS<T>
}

export type CSSClasses = {
  [key: string]: {
    [key in keyof CSSProperties]: CSSProperties[key] | CreateNestedCSS<key> | string
  }
}

type CreateHostCSSWithSelector<T extends keyof CSSProperties> = {
  [key: string]: CSSProperties[T]
}
export type CSSHostProperties = {
  [key in keyof CSSProperties]: CSSProperties[key] | CreateHostCSSWithSelector<key>
}

export type CSSKeyFrames = {
  from?: { [key in keyof CSSProperties]: CSSProperties[key] }
  to?: { [key in keyof CSSProperties]: CSSProperties[key] }
  [key: `${number}%`]: { [key in keyof CSSProperties]: CSSProperties[key] }
}

export type StylesObject = {
  className?: string | Array<string | undefined | false | null>
  stylesheet?: string | Array<string | undefined | false | null>
}

export type StyleObjects<T extends CSSClasses> = {
  [key in keyof T]: {
    className: string
    stylesheet: string[]
  }
}
