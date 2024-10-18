import { camelCase, kebabCase } from '../../utils/case.js'
import { trueTypeOf } from '../../utils/true-type-of.js'
import type {
  DesignToken,
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
} from '../token.types.js'
import { defaultPrefix } from './transformer.constants.js'
import {
  deduplicateCSS,
  getAliasExportName,
  getCssVarName,
  getColor,
  isDesignToken,
  isStaticToken,
  isValidContext,
  matchAlias,
  valueIsAlias,
} from './transformer.utils.js'

export class TransformTokens {
  #db = new Map<string, DesignToken>()
  #tokenPrefix: string
  #contexts: Contexts
  constructor({
    tokens,
    contexts,
    tokenPrefix = defaultPrefix,
  }: {
    tokens: DesignTokenGroup
    contexts: Contexts
    tokenPrefix?: string
  }) {
    this.#tokenPrefix = tokenPrefix
    this.#contexts = contexts ?? {}
    this.flattenTokens(tokens)
  }
  get ts() {
    return [...this.#db]
      .flatMap(([key, token]) => {
        const tokenPath = key.split('.')
        if (token.$type === 'composite') return this.getCompositeTokenReference(tokenPath, token) ?? []
        return this.getTokenReference(tokenPath, token) ?? []
      })
      .join('\n')
  }
  get css() {
    const vars = [...this.#db]
      .flatMap(([key, token]) => {
        const tokenPath = key.split('.')
        const { $type } = token
        return (
          $type === 'color' ? (this.formatColorToken(tokenPath, token) ?? [])
          : $type === 'gradient' ? (this.formatGradientToken(tokenPath, token) ?? [])
          : $type === 'angle' || $type === 'amount' || $type === undefined || $type === 'size' ?
            (this.formatToken(tokenPath, token) ?? [])
          : []
        )
      })
      .join('\n')
    return deduplicateCSS(vars)
  }
  flattenTokens(tokens: DesignTokenGroup, tokenPath: string[] = []) {
    if (trueTypeOf(tokens) !== 'object') return
    if (isDesignToken(tokens)) {
      this.#db.set(camelCase(tokenPath.join('.')), tokens)
    } else {
      for (const name in tokens) {
        this.flattenTokens(tokens[name] as DesignTokenGroup, [...tokenPath, name])
      }
    }
  }
  formatToken(tokenPath: string[], token: DefaultToken | AngleToken | AmountToken | SizeToken) {
    const prop = kebabCase(tokenPath.join(' '))
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
                const alias = matchAlias(val)
                return this.#db.has(alias) ? getCssVarName(alias.split('.'), this.#tokenPrefix) : []
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
  formatGradientToken(tokenPath: string[], token: GradientToken) {
    const prop = kebabCase(tokenPath.join(' '))
    const cb = ($value: GradientValue, ctx?: CTX) => {
      if (valueIsAlias($value)) {
        return this.formatAliasValue({ $value, prop, ctx })
      }
      const { gradientFunction, angleShapePosition, colorStops } = $value
      const stops = colorStops.flatMap(({ color, position }) => {
        if (valueIsAlias(color)) {
          const alias = matchAlias(color)
          return this.#db.has(alias) ?
              [getCssVarName(alias.split('.'), this.#tokenPrefix), position].filter(Boolean).join(' ')
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
  formatColorToken(tokenPath: string[], token: ColorToken) {
    const prop = kebabCase(tokenPath.join(' '))
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
  formatAliasValue({ $value, prop, ctx }: { $value: string; prop: string; ctx?: CTX }) {
    const alias = matchAlias($value)
    return this.#db.has(alias) ?
        this.getCSSRules({ prop, value: getCssVarName(alias.split('.'), this.#tokenPrefix), ctx })
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
      if (isValidContext(ctx, this.#contexts)) {
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
    const { mediaQueries = {}, colorSchemes = {} } = this.#contexts
    if (!ctx) return [`:host{`, `--${this.#tokenPrefix}-${prop}:${value};`, '}'].join('\n')
    const { type, id } = ctx
    if (type === 'color-scheme' && Object.hasOwn(colorSchemes, id)) {
      return [
        Object.keys(colorSchemes).indexOf(id) === 0 && `:host{`,
        `--${this.#tokenPrefix}-${prop}:${value};`,
        '}',
        `@media (prefers-color-scheme:${id}){:host{`,
        `--${this.#tokenPrefix}-${prop}:${value};`,
        '}}',
        `:host([data-color-scheme="${id}"]){`,
        `--${this.#tokenPrefix}-${prop}:${value};`,
        '}',
      ]
        .filter(Boolean)
        .join('\n')
    }
    if (type === 'media-query' && Object.hasOwn(mediaQueries, id)) {
      return [
        Object.keys(mediaQueries).indexOf(id) === 0 && `:host{`,
        `--${this.#tokenPrefix}-${prop}:${value};`,
        '}',
        `@media ${mediaQueries[id]}{:host{`,
        `--${this.#tokenPrefix}-${prop}:${value};`,
        '}}',
        `:host([data-media-query="${id}"]){`,
        `--${this.#tokenPrefix}-${prop}:${value};`,
        '}',
      ]
        .filter(Boolean)
        .join('\n')
    }
    return ''
  }
  getTokenReference(tokenPath: string[], token: Exclude<DesignToken, CompositeToken>) {
    const { $value } = token
    const isAlias = valueIsAlias($value)
    if (isAlias && !this.#db.has(matchAlias($value) ?? '')) {
      console.error(`Alias ${matchAlias($value)} not found`)
      return undefined
    }
    return `${this.getValueComment(token)}export const ${camelCase(tokenPath.join(' '))} = ${getCssVarName(tokenPath, this.#tokenPrefix)}`
  }
  getCompositeTokenReference(tokenPath: string[], token: CompositeToken) {
    const { $value } = token
    const isAlias = valueIsAlias($value)
    if (isAlias) {
      const alias = matchAlias($value)
      const validAlias = this.#db.has(alias)
      !validAlias && console.error(`Alias ${alias} not found`)
      return validAlias ?
          `${this.getValueComment(token)}export const ${camelCase(tokenPath.join(' '))} = ${getAliasExportName(alias)}`
        : undefined
    }
    const toRet: string[] = []
    for (const key in $value) {
      const val = $value[key]
      const alias = matchAlias(val)
      if (this.#db.has(alias)) {
        const name = getAliasExportName(alias)
        toRet.push(`${this.getValueComment(token)}  ${key}: ${name},`)
      }
    }
    return toRet.length ? [`export const ${camelCase(tokenPath.join(' '))} = {`, ...toRet, '}'].join('\n') : undefined
  }
  getValueComment(token: DesignToken): string {
    if (valueIsAlias(token.$value)) {
      const alias = matchAlias(token.$value)
      const aliasedToken = this.#db.get(alias)
      if (!aliasedToken) return ''
      return valueIsAlias(aliasedToken?.$value) ?
          this.getValueComment(aliasedToken)
        : `/**\n* @value ${JSON.stringify(aliasedToken.$value, null, 2)}\n*/`
    }
    return `/**\n* @value ${JSON.stringify(token.$value, null, 2)}\n*/`
  }
}
