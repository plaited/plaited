/**
 * Fork of easy-json-schema
 * (c) suxiaoxin - MIT
 * {@see https://github.com/easy-json-schema/easy-json-schema}
 */
import { trueTypeOf } from '../utils/true-type-of.js'
import type { DesignToken, DesignTokenGroup } from './design-token.types.js'

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
 * @see https://github.com/easy-json-schema/easy-json-schema Original implementation
 */
export const getDesignTokensSchema = <T extends DesignTokenGroup = DesignTokenGroup>(tokens: T) => {
  return parse<T>({ tokens })
}
