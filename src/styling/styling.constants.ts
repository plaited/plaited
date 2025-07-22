import { keyMirror } from '../utils.js'

export const CSS_RESERVED_KEYS = keyMirror('$default', '$states', '$parts', '$compoundSelectors', '$mediaQueries')

export const PREFERS_COLOR_SCHEME_QUERIES = {
  dark: '@media (prefers-color-scheme: dark)',
  light: '@media (prefers-color-scheme: light)',
} as const
