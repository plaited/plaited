import { trueTypeOf } from '@plaited/utils'
import { JSON, Schema } from '../types.js'
// Fork of https://github.com/easy-json-schema/easy-json-schema

const supportType = [ 'string', 'number', 'array', 'object', 'boolean', 'integer' ]

const isSchema = (object: JSON) => {
  if (supportType.indexOf(object.type as string) !== -1) {
    return true
  }
  return false
}

export const parse = ({
  json,
  JsonSchema = {},
  isValue = false,
  hasValue = false,
}: {
  json: JSON
  JsonSchema?: Schema,
  isValue?: boolean
  hasValue?: boolean
}) => {
  const handleSchema = (json: JSON, schema: Schema) => {
    Object.assign(schema, json)
    if (schema.type === 'object' && json.properties) {
      delete schema.properties
      parse({ json: json.properties, JsonSchema: schema, isValue, hasValue })
    }
    if (schema.type === 'array' && json.items) {
      delete schema.items
      schema.items = {}
      parse({ json: json.items, JsonSchema: schema.items, isValue, hasValue })
    }
  }
  const handleObject = (json: JSON, schema: Schema) => {
    if (isSchema(json)) {
      return handleSchema(json, schema)
    }
    schema.type = 'object'
    schema.required = []
    const props: Schema = schema.properties = {}
    for (let key in json) {
      schema.required.push(key)
      const item = json[key] as JSON
      let curSchema: Schema = props[key] = {}
      if (key[0] === '*') {
        delete props[key]
        key = key.substr(1)
        schema.required.push(key)
        curSchema = props[key] = {}
      }
      parse({ 
        json: item,
        JsonSchema: curSchema,
        isValue: isValue || key === '$value',
        hasValue: hasValue || item.hasOwnProperty('$value'),
      })
    }
  }
  const handleArray = (arr: JSON[], schema: Schema) => {
    schema.type = 'array'
    if(arr.length) {
      schema.items = []
      arr.forEach(element => {
        (schema.items as Schema[]).push(parse({ json: element, JsonSchema: { }, isValue, hasValue }))
      })
    }
  }
  const handlePrimitive = (arg: JSON ) => {
    JsonSchema.type = trueTypeOf(arg)
    if(isValue) {
      JsonSchema.const = arg
    }
  }
  trueTypeOf(json) === 'array'
    ? handleArray(json as unknown as JSON[], JsonSchema)
    : trueTypeOf(json) === 'object'
    ? handleObject(json, JsonSchema)
    : handlePrimitive(json)
  return JsonSchema
}
