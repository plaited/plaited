import type * as CSS from 'csstype'

export type CSSProperties = CSS.Properties<string | number> & {
  [key: string]: string | number
}

export type CreateNestedCSS<T extends keyof CSSProperties> = {
  default?: CSSProperties[T]
  [key: `@${'container' | 'layer' | 'media' | 'supports'}${string}`]: CSSProperties[T]
  [key: `:${string}`]: CSSProperties[T] | CreateNestedCSS<T>
  [key: `[${string}`]: CSSProperties[T] | CreateNestedCSS<T>
}

export type CreateCSS = {
  [key: string]: {
    [key in keyof CSSProperties]: CSSProperties[key] | CreateNestedCSS<key> | string
  }
}
export type CreateHostCSSWithSelector<T extends keyof CSSProperties> = {
  [key: string]: CSSProperties[T]
}
export type CreateHostCSS = {
  [key in keyof CSSProperties]: CSSProperties[key] | CreateHostCSSWithSelector<key>
}

export type CreateKeyframeCSS = {
  from?: { [key in keyof CSSProperties]: CSSProperties[key] }
  to?: { [key in keyof CSSProperties]: CSSProperties[key] }
  [key: `${number}%`]: { [key in keyof CSSProperties]: CSSProperties[key] }
}

export type AssignStylesObject = {
  className?: string | Array<string | undefined | false | null>
  stylesheet?: string | Array<string | undefined | false | null>
}

export type CreateStylesObjects<T extends CreateCSS> = {
  [key in keyof T]: {
    className: string
    stylesheet: string[]
  }
}
