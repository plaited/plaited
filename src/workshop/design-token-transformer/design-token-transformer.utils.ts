import type { DesignToken, DesignTokenGroup, DesignValue, MediaValue, Alias } from './design-token-transformer.types.js'
import { type CustomElementTag } from '../../main.js'
import { isTypeOf, trueTypeOf, kebabCase, camelCase, pascalCase } from '../../utils.js'

/**
 * Combines duplicate CSS rules (like :host selectors) into a single rule block.
 * @param css The raw CSS string potentially containing duplicate selectors.
 * @returns A CSS string with combined rules.
 * @internal
 */
export const combineCSSRules = (css: string) => {
  const regex = /((?:.*:host|:host\([^)]*\))[^{\n]*)\{(\s*[\s\S]*?\s*)\}/gm
  const map = new Map<string, Set<string>>()
  let match: RegExpExecArray | null
  while ((match = regex.exec(css)) !== null) {
    const selector = match[1]
    const rule = match[2].replace(/(\s\s+|\n)/g, ' ')
    const set = map.get(selector)
    if (set) {
      set.add(rule)
      continue
    }
    map.set(selector, new Set<string>([rule]))
  }
  return [...map]
    .flatMap(([key, val]) => {
      return [key, '{', ...val, key.startsWith('@') ? '}}' : '}']
    })
    .join('')
}

/**
 * Extracts the dot-separated path from a design token alias string (e.g., "{colors.primary.100}" -> "colors.primary.100").
 * @param value The alias string.
 * @returns An array representing the token path.
 * @internal
 */
export const getTokenPath = (value: string) => matchAlias(value).split('.')

/**
 * Creates a design token alias string from a path array, handling potential decimal keys.
 * @param tokenPath An array representing the token path (e.g., ['colors', 'primary', '100']).
 * @returns The formatted alias string (e.g., "{colors.primary.100}").
 * @internal
 */
export const getAlias = (tokenPath: string[]): Alias => {
  const lastKeyIsDecimal = /^\d*\.\d+$/.test(tokenPath[tokenPath.length - 1])
  const lastKey = lastKeyIsDecimal && `${tokenPath.pop()}`.replace('.', '_')
  return lastKey ? `{${camelCase(tokenPath.join('.'))}.${lastKey}}` : `{${camelCase(tokenPath.join('.'))}}`
}

/**
 * Generates a camelCase export name from a token path array for TypeScript variable names.
 * Handles decimal keys by appending them with an underscore.
 * @param tokenPath An array representing the token path.
 * @returns The camelCase export name (e.g., "colorsPrimary100").
 * @internal
 */
export const getExportName = (tokenPath: string[]): string => {
  const lastKeyIsDecimal = /^\d*_\d+$/.test(tokenPath[tokenPath.length - 1])
  const lastKey = lastKeyIsDecimal && tokenPath.pop()
  return lastKey ? `${camelCase(tokenPath.join(' '))}${lastKey}` : camelCase(tokenPath.join(' '))
}

/**
 * Generates the TypeScript export name directly from a design token alias.
 * @param alias The alias string.
 * @returns The camelCase export name.
 * @internal
 */
export const getAliasExportName = (alias: Alias) => {
  const path = getTokenPath(alias)
  return getExportName(path)
}

/**
 * Generates a kebab-case CSS custom property name fragment from an alias string.
 * Handles decimal keys by appending them with a hyphen.
 * @param value The alias string.
 * @returns The kebab-case property name fragment (e.g., "colors-primary-100").
 * @internal
 */
export const getProp = (value: Alias) => {
  const tokenPath = getTokenPath(value)
  const lastKeyIsDecimal = /^\d*_\d+$/.test(tokenPath[tokenPath.length - 1])
  const lastKey = lastKeyIsDecimal && tokenPath.pop()
  return lastKeyIsDecimal ? `${kebabCase(tokenPath.join(' '))}-${lastKey}` : kebabCase(tokenPath.join(' '))
}

/**
 * Converts a design token alias into a CSS `var()` function string.
 * @param alias The alias string.
 * @param prefix The prefix to use for the CSS custom property (e.g., 'pl').
 * @returns The CSS `var()` string (e.g., "var(--pl-colors-primary-100)").
 * @internal
 */
export const convertAliasToCssVar = (alias: Alias, prefix: string) => `var(--${prefix}-${getProp(alias)})`

/**
 * Type guard to check if an object is a DesignToken (has a $value property).
 * @param obj The object to check.
 * @returns True if the object is a DesignToken, false otherwise.
 * @internal
 */
export const isDesignToken = (obj: DesignToken | DesignTokenGroup): obj is DesignToken =>
  trueTypeOf(obj) === 'object' && Object.hasOwn(obj, '$value')

/**
 * Type guard to check if a design token's $value represents media-specific values.
 * @param $value The value to check.
 * @returns True if the value is a MediaValue object, false otherwise.
 * @internal
 */
export const isMediaValue = ($value: unknown): $value is MediaValue<DesignValue> => {
  return isTypeOf<Record<string, unknown>>($value, 'object') && Object.keys($value).every((key) => key.startsWith('@'))
}

/** @internal Matches the content inside curly braces of an alias string. */
const matchAlias = (value: string) => value.match(/^(?:\{)([^"]*?)(?:\})$/)?.[1] ?? ''

/**
 * Type guard to check if a value is a valid design token alias string (e.g., "{token.path}").
 * @param value The value to check.
 * @returns True if the value is an Alias string, false otherwise.
 * @internal
 */
export const valueIsAlias = (value: unknown): value is Alias => {
  if (isTypeOf<string>(value, 'string')) {
    return matchAlias(value).length > 0
  }
  return false
}

/**
 * Formats a non-media query CSS rule for a design token.
 * @param cssVar The full CSS custom property name (e.g., "--pl-color-primary").
 * @param value The CSS value for the property.
 * @returns A formatted CSS rule string targeting :host.
 * @internal
 */
export const formatNonMediaRule = (cssVar: string, value: string | number) =>
  [`:host{`, `${cssVar}:${value};`, '}'].join('\n')

/** Constant identifier for the light color scheme media query key. @internal */
export const LIGHT_ID = '@light' as const
/** Constant identifier for the dark color scheme media query key. @internal */
export const DARK_ID = '@dark' as const
/** Constant for the data attribute used to apply color scheme overrides. @internal */
export const DATA_COLOR_SCHEME = 'data-color-scheme' as const
/** Constant for the data attribute used to apply custom media query overrides. @internal */
export const DATA_MEDIA_QUERY = 'data-media-query' as const
/** Constant for the TypeScript file extension. @internal */
export const TS_EXTENSION = 'ts' as const
/** Constant for the CSS file extension. @internal */
export const CSS_EXTENSION = 'css' as const
/** Default prefix for Plaited design tokens. @internal */
export const PLAITED_PREFIX = 'pl' as const

/**
 * Formats a media query CSS rule for a design token, including data attribute selectors for overrides.
 * @param options Configuration object.
 * @param options.cssVar The full CSS custom property name.
 * @param options.id The media query identifier (e.g., '@light', '@desktop').
 * @param options.query The actual media query string (e.g., '(prefers-color-scheme: light)').
 * @param options.value The CSS value for the property within this media query.
 * @returns A formatted CSS rule string including the media query and data attribute selector.
 * @internal
 */
export const formatMediaRule = ({
  cssVar,
  query,
  value,
  id,
}: {
  cssVar: string
  id: string
  query: string
  value: string | number
}) =>
  [
    `@media ${query}{:host{`,
    `${cssVar}:${value};`,
    '}}',
    `:host([${id === LIGHT_ID || id === DARK_ID ? `${DATA_COLOR_SCHEME}="${id}"` : `${DATA_MEDIA_QUERY}="${id}"`}]){`,
    `${cssVar}:${value};`,
    '}',
  ].join('\n')

/**
 * Default media queries for light and dark color schemes.
 * @internal
 */
export const colorSchemeMediaQueries = new Map<typeof LIGHT_ID | typeof DARK_ID, string>([
  [LIGHT_ID, '(prefers-color-scheme: light)'],
  [DARK_ID, '(prefers-color-scheme: dark)'],
])

const supportType = ['string', 'number', 'array', 'object', 'boolean', 'integer']

type Schema = {
  items?: Schema[] | Schema
  required?: string[]
  properties?: Record<string, Schema>
  const?: unknown
  [key: string]: Record<string, Schema> | unknown
}

const isSchema = (object: Schema) => {
  if (supportType.indexOf(object.type as string) !== -1) {
    return true
  }
  return false
}

const parse = <T extends DesignTokenGroup = DesignTokenGroup>({
  tokens,
  JsonSchema = {},
  isValue = false,
  hasValue = false,
}: {
  tokens: T
  JsonSchema?: Schema
  isValue?: boolean
  hasValue?: boolean
}) => {
  const handleSchema = (json: Schema, schema: Schema) => {
    Object.assign(schema, json)
    if (schema.type === 'object' && json.properties) {
      delete schema.properties
      parse({
        tokens: json.properties as DesignTokenGroup,
        JsonSchema: schema,
        isValue,
        hasValue,
      })
    }
    if (schema.type === 'array' && json.items) {
      delete schema.items
      schema.items = {}
      parse({
        tokens: json.items as DesignTokenGroup,
        JsonSchema: schema.items,
        isValue,
        hasValue,
      })
    }
  }
  const handleObject = (json: DesignTokenGroup, schema: Schema) => {
    if (isSchema(json)) {
      return handleSchema(json, schema)
    }
    schema.type = 'object'
    schema.required = []
    const props: Record<string, unknown> = (schema.properties = {})
    for (let key in json) {
      schema.required.push(key)
      const item = json[key]
      let curSchema = (props[key] = {})
      if (key[0] === '*') {
        delete props[key]
        key = key.substr(1)
        schema.required.push(key)
        curSchema = props[key] = {}
      }
      parse({
        tokens: item as DesignTokenGroup,
        JsonSchema: curSchema,
        isValue: isValue || key === '$value',
        hasValue: hasValue || Object.hasOwn(item as DesignToken, '$value'),
      })
    }
  }
  const handleArray = (arr: Record<string, unknown>[], schema: Schema) => {
    schema.type = 'array'
    if (arr.length) {
      schema.items = []
      arr.forEach((element) => {
        const items = schema.items as unknown[]
        items.push(
          parse({
            tokens: element as unknown as DesignTokenGroup,
            JsonSchema: {},
            isValue,
            hasValue,
          }),
        )
      })
    }
  }
  const handlePrimitive = (arg: unknown) => {
    JsonSchema.type = trueTypeOf(arg)
    if (isValue) {
      JsonSchema.const = arg
    }
  }
  trueTypeOf(tokens) === 'array' ? handleArray(tokens as unknown as Record<string, unknown>[], JsonSchema)
  : trueTypeOf(tokens) === 'object' ? handleObject(tokens, JsonSchema)
  : handlePrimitive(tokens)
  return JsonSchema
}

/**
 * Converts a design token group into a JSON Schema with strict type validation.
 * Based on easy-json-schema (MIT licensed).
 *
 * Features:
 * - Full design token structure validation
 * - Const assertions for token values
 * - Nested object and array support
 * - Required field tracking
 * - Type inference for TypeScript
 *
 * @template T Type extending DesignTokenGroup
 * @param tokens Design token group to convert to JSON Schema
 * @returns JSON Schema object with:
 *  - Type definitions
 *  - Required fields
 *  - Const values for tokens
 *  - Nested property schemas
 *
 * @example
 * const tokens = {
 *   colors: {
 *     primary: {
 *       $description: "Primary brand color",
 *       $type: "color",
 *       $value: "#FF0000"
 *     }
 *   }
 * };
 *
 * const schema = getDesignTokensSchema(tokens);
 * // Results in:
 * // {
 * //   type: "object",
 * //   required: ["colors"],
 * //   properties: {
 * //     colors: {
 * //       type: "object",
 * //       required: ["primary"],
 * //       properties: {
 * //         primary: {
 * //           type: "object",
 * //           required: ["$description", "$type", "$value"],
 * //           properties: {
 * //             $value: { type: "string", const: "#FF0000" }
 * //           }
 * //         }
 * //       }
 * //     }
 * //   }
 * // }
 *
 * @remarks
 * - Maintains type safety through schema generation
 * - Handles all valid design token value types
 * - Preserves token hierarchy in schema
 * - Useful for validation and documentation
 * - Can be used with standard JSON Schema validators
 *
 */
export const getDesignTokensSnapshot = <T extends DesignTokenGroup = DesignTokenGroup>(tokens: T) => {
  return parse<T>({ tokens })
}

export const getDesignTokensElement = (
  stylesheet: string,
  tag: CustomElementTag = 'design-tokens',
) => `import { bElement, css, h } from 'plaited'

const tokens = {
  stylesheet: [${stylesheet}]
}

export const ${pascalCase(tag)} = bElement({
  tag: ${tag},
  shadowDom: h('slot', {
    ...css.join(
      css.host({
        display: 'contents',
      }),
      { stylesheet: [stylesheet] },
    )
  }),
})
`
