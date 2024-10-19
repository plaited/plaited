import { camelCase } from '../../utils/case.js'
import { trueTypeOf } from '../../utils/true-type-of.js'
import type {
  DesignToken,
  DesignTokenEntry,
  FilterCallback,
  DesignTokenGroup,
  Contexts,
  CompositeToken,
  ContextTypes,
  ContextualToken,
  CTX,
  DefaultToken,
  AngleToken,
  AmountToken,
  SizeToken,
  GradientToken,
  ColorToken,
  ColorValue,
  DesignValue,
  GradientValue,
  DefaultValue,
  AngleValue,
  SizeValue,
  AmountValue,
  MediaQueries,
  ColorSchemes,
  AliasValue,
} from '../token.types.js'
import { defaultPrefix } from './transformer.constants.js'
import {
  convertAliasToCssVar,
  convertTokenPathToValue,
  deduplicateCSS,
  getAliasExportName,
  getColor,
  getProp,
  getTokenPath,
  isDesignToken,
  isStaticToken,
  isValidContext,
  valueIsAlias,
} from './transformer.utils.js'

export class TransformTokens {
  db = new Map<AliasValue, DesignTokenEntry>()
  tokenPrefix: string
  contexts: Contexts
  constructor({
    tokens,
    contexts = {},
    tokenPrefix = defaultPrefix,
  }: {
    tokens: DesignTokenGroup
    contexts?: { mediaQueries?: MediaQueries; colorSchemes?: ColorSchemes }
    tokenPrefix?: string
  }) {
    this.tokenPrefix = tokenPrefix
    this.contexts = { mediaQueries: {}, colorSchemes: {}, ...contexts }
    this.flattenTokens(tokens)
  }
  // VALIDATE ALIAS EXIST IN DB
  checkAlias(alias: AliasValue) {
    const hasAlias = this.db.has(alias)
    if (!hasAlias) {
      console.error(`Invalid token alias: {${alias}}`)
    }
    return hasAlias
  }
  // GET TS DESIGN TOKEN REFERENCES
  get ts() {
    const str = [...this.db]
      .flatMap(([key, token]) => {
        const tokenPath = getTokenPath(key)
        if (token.$type === 'composite') return this.getCompositeTokenReference(tokenPath, token) ?? []
        return this.getTokenReference(tokenPath, token) ?? []
      })
      .join('\n')
    return str.length ? str + '\n' : ''
  }
  // GET CSS VARIABLE FORMATTED DESIGN TOKENS
  get css() {
    const vars = [...this.db]
      .flatMap(([key, token]) => {
        const { $type } = token
        return (
          $type === 'color' ? (this.formatColorToken(key, token) ?? [])
          : $type === 'gradient' ? (this.formatGradientToken(key, token) ?? [])
          : $type === 'angle' || $type === 'amount' || $type === undefined || $type === 'size' ?
            (this.formatToken(key, token) ?? [])
          : []
        )
      })
      .join('\n')
    const str = deduplicateCSS(vars)
    return str.length ? str + '\n' : ''
  }
  // FLATTEN DESIGN TOKEN GROUP
  flattenTokens(tokens: DesignTokenGroup, tokenPath: string[] = []) {
    if (trueTypeOf(tokens) !== 'object') return
    if (isDesignToken(tokens)) {
      this.db.set(`{${camelCase(tokenPath.join('.'))}}`, { ...tokens, dependents: [], dependencies: [] })
    } else {
      for (const name in tokens) {
        this.flattenTokens(tokens[name] as DesignTokenGroup, [...tokenPath, name])
      }
    }
  }
  // FORMAT DESIGN TOKEN METHODS
  formatToken(key: AliasValue, token: DefaultToken | AngleToken | AmountToken | SizeToken) {
    const prop = getProp(key)
    const isCommaSeparated = Boolean(token?.$extensions?.plaited?.commaSeparated)
    const cb = ($value: DefaultValue | AngleValue | AmountValue | SizeValue, ctx?: CTX) => {
      if (valueIsAlias($value)) {
        return this.formatAliasValue({ $value, prop, ctx })
      }
      const value =
        Array.isArray($value) ?
          $value
            .flatMap((val) => {
              if (valueIsAlias(val)) {
                return this.checkAlias(val) ? convertAliasToCssVar(val, this.tokenPrefix) : []
              }
              return val
            })
            .join(isCommaSeparated ? ', ' : ' ')
        : $value
      return this.getCSSRules({ prop, value, ctx })
    }
    if (isStaticToken(token)) {
      return cb(token.$value)
    }
    return this.formatContextualToken<
      DefaultValue | AngleValue | AmountValue | SizeValue,
      'angle' | 'amount' | 'size' | undefined
    >(token, cb)
  }
  formatGradientToken(key: AliasValue, token: GradientToken) {
    const prop = getProp(key)
    const cb = ($value: GradientValue, ctx?: CTX) => {
      if (valueIsAlias($value)) {
        return this.formatAliasValue({ $value, prop, ctx })
      }
      const { gradientFunction, angleShapePosition, colorStops } = $value
      const stops = colorStops.flatMap(({ color, position }) => {
        if (valueIsAlias(color)) {
          return this.checkAlias(color) ?
              [convertAliasToCssVar(color, this.tokenPrefix), position].filter(Boolean).join(' ')
            : []
        }
        return [color && getColor(color), position].filter(Boolean).join(' ')
      })
      return this.getCSSRules({
        prop,
        value: `${gradientFunction}(${[angleShapePosition, ...stops].filter(Boolean).join(',')})`,
        ctx,
      })
    }
    if (isStaticToken(token)) {
      return cb(token.$value)
    }
    return this.formatContextualToken<GradientValue, 'gradient'>(token, cb)
  }
  formatColorToken(key: AliasValue, token: ColorToken) {
    const prop = getProp(key)
    const cb = ($value: ColorValue, ctx?: CTX) => {
      if (valueIsAlias($value)) {
        return this.formatAliasValue({ $value, prop, ctx })
      }
      return this.getCSSRules({ prop, value: getColor($value), ctx })
    }
    if (isStaticToken(token)) {
      return cb(token.$value)
    }
    return this.formatContextualToken<ColorValue, 'color'>(token, cb)
  }
  formatAliasValue({ $value, prop, ctx }: { $value: AliasValue; prop: string; ctx?: CTX }) {
    return this.checkAlias($value) ?
        this.getCSSRules({ prop, value: convertAliasToCssVar($value, this.tokenPrefix), ctx })
      : ''
  }
  formatContextualToken<V extends DesignValue, T = unknown>(
    token: ContextualToken<V, T>,
    cb: (value: V, ctx?: CTX) => string,
  ) {
    const toRet: string[] = []
    const { $value, $extensions } = token
    for (const id in $value) {
      const contextValue = $value[id]
      const ctx = { type: $extensions.plaited.context, id }
      if (isValidContext(ctx, this.contexts)) {
        toRet.push(cb(contextValue, ctx))
      }
    }
    return toRet.join('\n')
  }
  getCSSRules({
    ctx,
    prop,
    value,
  }: {
    ctx?: { type: ContextTypes; id: string }
    prop: string
    value: string | number
  }) {
    const { mediaQueries = {}, colorSchemes = {} } = this.contexts
    if (!ctx) return [`:host{`, `--${this.tokenPrefix}-${prop}:${value};`, '}'].join('\n')
    const { type, id } = ctx
    if (type === 'color-scheme' && Object.hasOwn(colorSchemes, id)) {
      return [
        Object.keys(colorSchemes).indexOf(id) === 0 && `:host{`,
        `--${this.tokenPrefix}-${prop}:${value};`,
        '}',
        `@media (prefers-color-scheme:${id}){:host{`,
        `--${this.tokenPrefix}-${prop}:${value};`,
        '}}',
        `:host([data-color-scheme="${id}"]){`,
        `--${this.tokenPrefix}-${prop}:${value};`,
        '}',
      ]
        .filter(Boolean)
        .join('\n')
    }
    if (type === 'media-query' && Object.hasOwn(mediaQueries, id)) {
      return [
        Object.keys(mediaQueries).indexOf(id) === 0 && `:host{`,
        `--${this.tokenPrefix}-${prop}:${value};`,
        '}',
        `@media ${mediaQueries[id]}{:host{`,
        `--${this.tokenPrefix}-${prop}:${value};`,
        '}}',
        `:host([data-media-query="${id}"]){`,
        `--${this.tokenPrefix}-${prop}:${value};`,
        '}',
      ]
        .filter(Boolean)
        .join('\n')
    }
    return ''
  }
  // GET TOKEN REFERENCE METHODS
  getTokenReference(tokenPath: string[], token: Exclude<DesignToken, CompositeToken>) {
    const { $value } = token
    if (valueIsAlias($value) && !this.checkAlias($value)) {
      console.error(`Alias ${$value} not found`)
      return undefined
    }
    return `export const ${camelCase(tokenPath.join(' '))} = "${convertTokenPathToValue(tokenPath, this.tokenPrefix)}"`
  }
  getCompositeTokenReference(tokenPath: string[], token: CompositeToken) {
    const { $value } = token
    if (valueIsAlias($value)) {
      const validAlias = this.checkAlias($value)
      !validAlias && console.error(`Alias ${$value} not found`)
      return validAlias ?
          `export const ${camelCase(tokenPath.join(' '))} = "${convertAliasToCssVar($value, this.tokenPrefix)}"`
        : undefined
    }
    const toRet: string[] = []
    for (const key in $value) {
      const val = $value[key]
      if (this.checkAlias(val)) {
        const name = getAliasExportName(val)
        toRet.push(`  ${key}: ${name},`)
      }
    }
    return toRet.length ? [`export const ${camelCase(tokenPath.join(' '))} = {`, ...toRet, '}'].join('\n') : undefined
  }
  getValueComment(token: DesignToken): string {
    if (valueIsAlias(token.$value)) {
      const aliasedToken = this.db.get(token.$value)
      if (!aliasedToken) return ''
      return valueIsAlias(aliasedToken?.$value) ?
          this.getValueComment(aliasedToken)
        : `/**\n* @value ${JSON.stringify(aliasedToken.$value, null, 2)}\n*/`
    }
    return `/**\n* @value ${JSON.stringify(token.$value, null, 2)}\n*/`
  }
  // QUERY DESIGN TOKEN METHODS
  filter = (cb: FilterCallback) => {
    const arr = [...structuredClone(this.db)]
    return arr.filter(cb)
  }
  get = (alias: AliasValue) => {
    const value = this.db.get(alias)
    if (value) return structuredClone(value)
  }
  has = (alias: AliasValue) => {
    return this.db.has(alias)
  }
}
