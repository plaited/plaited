import { camelCase } from '../../utils/case.js'
import { isTypeOf } from '../../utils/is-type-of.js'
import { trueTypeOf } from '../../utils/true-type-of.js'
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
  CompositeToken,
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
  LIGHT_ID,
  DARK_ID,
  TS_EXTENSION,
  CSS_EXTENSION,
  PLAITED_PREFIX,
} from './transform-design-tokens.utils.js'

/**
 * Transforms design tokens into CSS custom properties and TypeScript references.
 * Handles token resolution, dependency management, and code generation.
 *
 * Features:
 * - Converts design tokens to CSS variables
 * - Generates TypeScript type definitions
 * - Manages token dependencies and circular references
 * - Supports media queries and color schemes
 * - Handles token aliasing and composition
 * - Provides token validation and error checking
 *
 * @class
 * @implements {TransformDesignTokensInterface}
 *
 * @example
 * const transformer = new TransformDesignTokens({
 *   tokens: {
 *     colors: {
 *       primary: {
 *         $description: "Primary brand color",
 *         $type: "color",
 *         $value: "#FF0000"
 *       }
 *     }
 *   },
 *   tokenPrefix: "brand",
 *   defaultMediaQueries: { colorScheme: "@light" }
 * });
 *
 * // Get CSS output
 * console.log(transformer.css);
 * // :hoot { --brand-colors-primary: #FF0000; }
 *
 * // Get TypeScript output
 * console.log(transformer.ts);
 * // export const colorsPrimary = "--brand-colors-primary" as const;
 *
 * // Query token entries
 * const allEntries = transformer.entries;  // All token entries
 * const colorTokens = transformer.filter(([alias]) => alias.includes('color'));
 * const primaryToken = transformer.get('{colors.primary}');
 * const hasToken = transformer.has('{colors.primary}');
 *
 * @property {string} ts - Generated TypeScript definitions
 * @property {string} css - Generated CSS custom properties
 * @property {Array<[Alias, DesignTokenEntry]>} entries - Gets all token entries as [Alias, DesignTokenEntry][]
 * Methods:
 * @method filter Filters token entries using a callback function
 * @method get Retrieves a specific token entry by its alias
 * @method has Checks if a token exists by its alias
 *
 * @example Query Methods
 * // Filter tokens
 * const shadows = transformer.filter(([alias, entry]) =>
 *   entry.$type === 'function' && alias.includes('shadow')
 * );
 *
 * // Get specific token
 * const primary = transformer.get('{colors.primary}');
 * if (primary) {
 *   console.log(primary.$value);
 * }
 *
 * // Check token existence
 * if (transformer.has('{colors.secondary}')) {
 *   // Use secondary color
 * }
 *
 * @param options Configuration options
 * @param options.tokens Design token group to transform
 * @param options.tokenPrefix Prefix for CSS custom properties (default: 'pl')
 * @param options.mediaQueries Custom media query definitions
 * @param options.defaultMediaQueries Default media query settings
 *
 * @remarks
 * - Handles circular dependency detection
 * - Supports nested token structures
 * - Preserves token documentation
 * - Provides deep cloned copies of entries for safety
 * - Supports filtering and querying token collections
 * - Enables efficient token lookup and validation
 *
 * @throws {Error} On circular dependencies or invalid token definitions
 */
export class TransformDesignTokens implements TransformDesignTokensInterface {
  #db = new Map<Alias, DesignTokenEntry>()
  #tokenPrefix: string
  #ts: string
  #css: string
  #defaultMediaQueries: DefaultMediaQueries
  #mediaQueries: Map<typeof LIGHT_ID | typeof DARK_ID | `@${string}`, string>
  constructor({
    tokens,
    tokenPrefix = PLAITED_PREFIX,
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
  #circularDependencyCheck(dependent: Alias, dependency: Alias, path: string[] = []) {
    const depPath = [...path, dependency]
    const { dependencies } = this.#db.get(dependency) ?? {}
    if (!dependencies) return
    if (dependencies.includes(dependent)) {
      throw new Error(`Circular dependency found for ${dependent}\ndependencyPath: [${depPath.join(', ')}]`)
    }
    for (const dep of dependencies) {
      this.#circularDependencyCheck(dependent, dep, depPath)
    }
  }
  #sortAndMapEntries({
    arr,
    clone,
    type,
    dependency,
  }: {
    arr: string[]
    clone: Map<`{${string}}`, DesignTokenEntry>
    type: typeof TS_EXTENSION | typeof CSS_EXTENSION
    dependency?: Alias
  }) {
    if (dependency) {
      const entry = clone.get(dependency)
      if (!entry) return
      const dependencies = entry.dependencies
      if (dependencies.length)
        for (const dep of dependencies) {
          this.#sortAndMapEntries({
            arr,
            type,
            clone,
            dependency: dep,
          })
        }
      const str = entry[type]
      str && arr.push(str)
      clone.delete(dependency)
      return
    }
    for (const [key, entry] of clone) {
      const dependencies = entry.dependencies
      if (dependencies.length) {
        for (const dep of dependencies) {
          this.#circularDependencyCheck(key, dep)
          this.#sortAndMapEntries({
            arr,
            type,
            clone,
            dependency: dep,
          })
        }
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
      type: CSS_EXTENSION,
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
      type: TS_EXTENSION,
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
    const { dependencies } = this.#db.get(dependent) ?? {}
    if (dependencies) {
      !dependencies.includes(dependency) && dependencies.push(dependency)
    }
    const { dependents } = this.#db.get(dependency) ?? {}
    if (dependents) {
      !dependents.includes(dependent) && dependents.push(dependent)
    }
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
  #setCompositeDeps(dependent: Alias, token: CompositeToken) {
    if (token.$type === 'composite') {
      const { $value } = token
      if (isTypeOf<Alias>($value, 'string')) return this.#updateDependencies(dependent, $value)
      for (const dependency of Object.values($value)) {
        this.#updateDependencies(dependent, dependency)
      }
      return
    }
  }
  #tokenToCss(key: Alias, token: DesignToken) {
    if (token.$type === 'composite') return this.#setCompositeDeps(key, token)
    const { $type, $csv, $value } = token
    const entry = this.#db.get(key)!
    const cssVar = `--${this.#tokenPrefix}-${getProp(key)}`
    entry.cssVar = cssVar
    if ($type === 'color') {
      if (!isMediaValue($value)) {
        return this.#updateEntry({
          entry,
          content: formatNonMediaRule(cssVar, this.#getColor(key, $value)),
          type: CSS_EXTENSION,
        })
      }
      const map = new Map<string, string>(
        Object.entries($value).map<[string, string]>(([media, val]) => [media, this.#getColor(key, val)]),
      )
      return this.#updateEntry({
        entry,
        content: this.#getCSSRules(cssVar, map),
        type: CSS_EXTENSION,
      })
    }
    if ($type === 'function') {
      if (!isMediaValue($value))
        return this.#updateEntry({
          entry,
          content: formatNonMediaRule(cssVar, this.#getFunction({ key, $value, $csv })),
          type: CSS_EXTENSION,
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
        type: CSS_EXTENSION,
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
        type: CSS_EXTENSION,
      })
    }
    return this.#updateEntry({
      entry,
      content: formatNonMediaRule(cssVar, this.#getValue({ key, $value, $csv })),
      type: CSS_EXTENSION,
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
        type: TS_EXTENSION,
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
      type: TS_EXTENSION,
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
