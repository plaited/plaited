import { camelCase } from '../utils/case.js'
import { isTypeOf } from '../utils/is-type-of.js'
import { trueTypeOf } from '../utils/true-type-of.js'
import type {
  DesignToken,
  DesignTokenEntry,
  TransformDesignTokensInterface,
  DesignTokenGroup,
  ColorValue,
  FunctionValue,
  DefaultValue,
  DefaultMediaQueries,
  MediaQueries,
  Alias,
} from './design-token.types.js'
import {
  colorSchemeMediaQueries,
  convertAliasToCssVar,
  combineCSSRules,
  getAlias,
  getAliasExportName,
  getExportName,
  getProp,
  getTokenPath,
  isDesignToken,
  isMediaValue,
  valueIsAlias,
  formatNonMediaRule,
  formatMediaRule,
} from './transform-design-tokens.utils.js'

export class TransformDesignTokens implements TransformDesignTokensInterface {
  #db = new Map<Alias, DesignTokenEntry>()
  #tokenPrefix: string
  #ts: string
  #css: string
  #defaultMediaQueries: DefaultMediaQueries
  #mediaQueries: Map<'@light' | '@dark' | `@${string}`, string>
  constructor({
    tokens,
    tokenPrefix = 'pl',
    defaultMediaQueries = {},
    mediaQueries,
  }: {
    tokens: DesignTokenGroup
    /** @default 'pl' */
    tokenPrefix?: string
    /** @default Map { '@light': '(prefers-color-scheme: light)', '@dark': '(prefers-color-scheme: dark)' }*/
    mediaQueries?: MediaQueries
    /** @default { colorScheme: '@light' } */
    defaultMediaQueries?: DefaultMediaQueries
  }) {
    this.#tokenPrefix = tokenPrefix
    this.#defaultMediaQueries = defaultMediaQueries
    this.#mediaQueries = new Map([...colorSchemeMediaQueries, ...(mediaQueries ?? [])])
    this.#flattenTokens(tokens)
    this.#css = this.#createCSS()
    this.#ts = this.#createTS()
  }
  /**
   * Typescript references to CSS variables
   */
  get ts() {
    return this.#ts
  }
  /**
   * Stylesheet of design tokens transformed into CSS variables
   */
  get css() {
    return this.#css
  }
  /**
   * Get a list of all design token entries
   */
  get entries() {
    return [...structuredClone(this.#db)]
  }
  /**
   * Get a filtered list of design token entries
   */
  filter: TransformDesignTokensInterface['filter'] = (cb) => {
    const arr = [...structuredClone(this.#db)]
    return arr.filter(cb)
  }
  /**
   * Get a design token's entry via it's Alias
   */
  get: TransformDesignTokensInterface['get'] = (alias) => {
    const value = this.#db.get(alias)
    if (value) return structuredClone(value)
  }
  /**
   * Check if design token exist via it's Alias
   */
  has: TransformDesignTokensInterface['has'] = (alias) => {
    return this.#db.has(alias)
  }
  #sortAndMapEntries({
    arr,
    clone,
    type,
    depAlias,
  }: {
    arr: string[]
    clone: Map<`{${string}}`, DesignTokenEntry>
    type: 'ts' | 'css'
    depAlias?: `{${string}}`
  }) {
    if (depAlias) {
      const entry = clone.get(depAlias)
      if (!entry) return
      const dependencies = entry.dependencies
      if (dependencies.length)
        for (const dep of dependencies)
          this.#sortAndMapEntries({
            arr,
            type,
            clone,
            depAlias: dep,
          })
      const str = entry[type]
      str && arr.push(str)
      clone.delete(depAlias)
      return
    }
    for (const [key, entry] of clone) {
      const dependencies = entry.dependencies
      if (dependencies.length) {
        for (const dep of dependencies)
          this.#sortAndMapEntries({
            arr,
            type,
            clone,
            depAlias: dep,
          })
      }
      const str = entry[type]
      str && arr.push(str)
      clone.delete(key)
    }
  }
  #createCSS() {
    for (const [key, entry] of this.#db) {
      this.#tokenToCss(key, entry)
    }
    const clone = structuredClone(this.#db)
    const arr: string[] = []
    this.#sortAndMapEntries({
      arr,
      clone,
      type: 'css',
    })
    const vars = arr.join('\n')
    const str = combineCSSRules(vars)
    return str.length ? str + '\n' : ''
  }
  #createTS() {
    for (const [key, entry] of this.#db) {
      this.#getTokenReference(key, entry)
    }
    const clone = structuredClone(this.#db)
    const arr: string[] = []
    this.#sortAndMapEntries({
      arr,
      clone,
      type: 'ts',
    })
    const str = arr.join('\n')
    return str.length ? str + '\n' : ''
  }
  #flattenTokens(tokens: DesignTokenGroup, tokenPath: string[] = []) {
    const topLevel = !tokenPath.length
    if (trueTypeOf(tokens) !== 'object') return
    if (isDesignToken(tokens)) {
      if (topLevel) return
      const alias = getAlias(tokenPath.map((str) => camelCase(str)))
      if (this.#db.has(alias)) {
        return console.error(`Alias ${alias} already exist rename token at [${tokenPath.join(', ')}]`)
      }
      this.#db.set(alias, { ...tokens, dependents: [], dependencies: [] })
    } else {
      for (const name in tokens) {
        if (topLevel && /^[0-9]/.test(`${name}`)) {
          console.error(`Rename top level token group [${name}]. Top level keys cannot start with a number.`)
          continue
        }
        this.#flattenTokens(tokens[name] as DesignTokenGroup, [...tokenPath, name])
      }
    }
  }
  #updateEntry({ entry, content, type }: { entry: DesignTokenEntry; content?: string; type: 'ts' | 'css' }) {
    entry[type] = content
  }
  #checkAlias(alias: Alias) {
    const hasAlias = this.#db.has(alias)
    if (!hasAlias) {
      console.error(`Invalid token alias: ${alias}`)
    }
    return hasAlias
  }
  #updateDependencies(dependent: Alias, dependency: Alias) {
    const dependentDependencies = this.#db.get(dependent)!.dependencies
    !dependentDependencies.includes(dependency) && dependentDependencies.push(dependency)
    const dependencyDependents = this.#db.get(dependency)!.dependents
    !dependencyDependents.includes(dependent) && dependencyDependents.push(dependent)
  }
  #convertAliasToCssVar(key: Alias, $value: Alias) {
    if (this.#checkAlias($value)) {
      this.#updateDependencies(key, $value)
      return convertAliasToCssVar($value, this.#tokenPrefix)
    }
  }
  #getValue({ key, $value, $csv }: { key: Alias; $value: DefaultValue; $csv?: boolean }) {
    if (valueIsAlias($value)) return this.#convertAliasToCssVar(key, $value) ?? ''
    if (Array.isArray($value)) {
      return $value
        .flatMap((val) => {
          if (valueIsAlias(val)) return this.#convertAliasToCssVar(key, val) ?? []
          return val
        })
        .join($csv ? ', ' : ' ')
    }
    return $value
  }
  #getColor(key: Alias, $value: ColorValue) {
    if (valueIsAlias($value)) return this.#convertAliasToCssVar(key, $value) ?? ''
    if (isTypeOf<string>($value, 'string')) return $value
    const val = [$value.l ?? 'none', $value.c ?? 'none', $value.h ?? 'none', '/', $value.a ?? 'none']
    return `oklch(${this.#getValue({ key, $value: val, $csv: false })})`
  }
  #getFunction({ key, $value, $csv }: { key: Alias; $value: FunctionValue; $csv?: boolean }) {
    if (valueIsAlias($value)) return this.#convertAliasToCssVar(key, $value) ?? ''
    return `${$value.function}(${this.#getValue({ key, $csv, $value: $value.arguments })})`
  }
  #tokenToCss(key: Alias, token: DesignToken) {
    if (token.$type === 'composite') return
    const { $type, $csv, $value } = token
    const entry = this.#db.get(key)!
    const cssVar = `--${this.#tokenPrefix}-${getProp(key)}`
    entry.cssVar = cssVar
    if ($type === 'color') {
      if (!isMediaValue($value)) {
        return this.#updateEntry({
          entry,
          content: formatNonMediaRule(cssVar, this.#getColor(key, $value)),
          type: 'css',
        })
      }
      const map = new Map<string, string>(
        Object.entries($value).map<[string, string]>(([media, val]) => [media, this.#getColor(key, val)]),
      )
      return this.#updateEntry({
        entry,
        content: this.#getCSSRules(cssVar, map),
        type: 'css',
      })
    }
    if ($type === 'function') {
      if (!isMediaValue($value))
        return this.#updateEntry({
          entry,
          content: formatNonMediaRule(cssVar, this.#getFunction({ key, $value, $csv })),
          type: 'css',
        })
      const map = new Map<string, string>(
        Object.entries($value).map<[string, string]>(([media, val]) => [
          media,
          this.#getFunction({ key, $value: val, $csv }),
        ]),
      )
      return this.#updateEntry({
        entry,
        content: this.#getCSSRules(cssVar, map),
        type: 'css',
      })
    }
    if (isMediaValue($value)) {
      const map = new Map<string, string | number>(
        Object.entries($value).map<[string, string | number]>(([media, val]) => [
          media,
          this.#getValue({ key, $value: val, $csv }),
        ]),
      )
      return this.#updateEntry({
        entry,
        content: this.#getCSSRules(cssVar, map),
        type: 'css',
      })
    }
    return this.#updateEntry({
      entry,
      content: formatNonMediaRule(cssVar, this.#getValue({ key, $value, $csv })),
      type: 'css',
    })
  }
  #getCSSRules(cssVar: string, $value: Map<string, string | number>) {
    const toRet: string[] = []
    const { colorScheme = '@light', screen } = this.#defaultMediaQueries
    $value.has(colorScheme) && toRet.push(formatNonMediaRule(cssVar, $value.get(colorScheme)!))
    screen && $value.has(screen) && toRet.push(formatNonMediaRule(cssVar, $value.get(screen)!))
    for (const [id, query] of this.#mediaQueries) {
      $value.has(id) &&
        toRet.push(
          formatMediaRule({
            cssVar,
            id,
            query,
            value: $value.get(id)!,
          }),
        )
    }
    return toRet.join('\n')
  }
  #getTokenReference(key: Alias, token: DesignToken) {
    const { $value, $type } = token
    const tokenPath = getTokenPath(key)
    const isAlias = valueIsAlias($value)
    const exportName = getExportName(tokenPath)
    const entry = this.#db.get(key)!
    entry['exportName'] = exportName
    if (isAlias || $type !== 'composite') {
      const comment = this.#getComment(isAlias ? $value : key)
      return this.#updateEntry({
        entry,
        content:
          comment ?
            [
              comment,
              `export const ${exportName} = ${isAlias ? getAliasExportName($value) : `"${convertAliasToCssVar(key, this.#tokenPrefix)}" as const`}`,
            ].join('\n')
          : undefined,
        type: 'ts',
      })
    }
    const toRet: string[] = []
    for (const key in $value) {
      const val = $value[key]
      const comment = this.#getComment(val)
      if (comment) {
        const name = getAliasExportName(val)
        toRet.push(comment, `  ${key}: ${name},`)
      }
    }
    return this.#updateEntry({
      entry,
      content: toRet.length ? [`export const ${exportName} = {`, ...toRet, '}'].join('\n') : undefined,
      type: 'ts',
    })
  }
  #getComment(alias: Alias): string | undefined {
    if (this.#checkAlias(alias)) {
      const { $value, $description } = this.#db.get(alias)!
      if (valueIsAlias($value)) return this.#getComment($value)
      return [
        '/**',
        ...($description ? [`  @description ${$description}`] : []),
        `  @value ${JSON.stringify($value, null, 1)}`,
        '*/',
      ].join('\n')
    }
  }
}
