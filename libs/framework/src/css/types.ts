import type * as CSS from 'csstype'

export type CSSProperties = CSS.Properties<string | number> & {
  [key: string]: string | number
}

export type CSSPropertiesObjectLiteral<T extends keyof CSSProperties> = {
  default?: CSSProperties[T]
  [key: `@${'container' | 'layer' | 'media' | 'supports'}${string}`]: CSSProperties[T]
  [key: `:${string}`]: CSSProperties[T] | CSSPropertiesObjectLiteral<T>
  [key: `[${string}`]: CSSProperties[T] | CSSPropertiesObjectLiteral<T>
}

export type CSSClasses = {
  [key: string]: {
    [key in keyof CSSProperties]: CSSProperties[key] | CSSPropertiesObjectLiteral<key> | string
  }
}

export type AssignStylesObject = {
  className?: string | Array<string | undefined | false | null>
  stylesheet?: string | Array<string | undefined | false | null>
}

export type CreateStylesObjects<T extends CSSClasses> = {
  [key in keyof T]: {
    className: string
    stylesheet: string[]
  }
}
