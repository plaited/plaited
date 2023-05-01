// Fork of https://github.com/easy-json-schema/easy-json-schema
import { trueTypeOf } from '@plaited/utils';
const supportType = [
    'string',
    'number',
    'array',
    'object',
    'boolean',
    'integer',
];
const isSchema = (object) => {
    if (supportType.indexOf(object.type) !== -1) {
        return true;
    }
    return false;
};
export const parse = ({ tokens, JsonSchema = {}, isValue = false, hasValue = false, }) => {
    const handleSchema = (json, schema) => {
        Object.assign(schema, json);
        if (schema.type === 'object' && json.properties) {
            delete schema.properties;
            parse({
                tokens: json.properties,
                JsonSchema: schema,
                isValue,
                hasValue,
            });
        }
        if (schema.type === 'array' && json.items) {
            delete schema.items;
            schema.items = {};
            parse({
                tokens: json.items,
                JsonSchema: schema.items,
                isValue,
                hasValue,
            });
        }
    };
    const handleObject = (json, schema) => {
        if (isSchema(json)) {
            return handleSchema(json, schema);
        }
        schema.type = 'object';
        schema.required = [];
        const props = schema.properties = {};
        for (let key in json) {
            schema.required.push(key);
            const item = json[key];
            let curSchema = props[key] = {};
            if (key[0] === '*') {
                delete props[key];
                key = key.substr(1);
                schema.required.push(key);
                curSchema = props[key] = {};
            }
            parse({
                tokens: item,
                JsonSchema: curSchema,
                isValue: isValue || key === '$value',
                hasValue: hasValue ||
                    Object.hasOwn(item, '$value'),
            });
        }
    };
    const handleArray = (arr, schema) => {
        schema.type = 'array';
        if (arr.length) {
            schema.items = [];
            arr.forEach(element => {
                const items = schema.items;
                items.push(parse({
                    tokens: element,
                    JsonSchema: {},
                    isValue,
                    hasValue,
                }));
            });
        }
    };
    const handlePrimitive = (arg) => {
        JsonSchema.type = trueTypeOf(arg);
        if (isValue) {
            JsonSchema.const = arg;
        }
    };
    trueTypeOf(tokens) === 'array'
        ? handleArray(tokens, JsonSchema)
        : trueTypeOf(tokens) === 'object'
            ? handleObject(tokens, JsonSchema)
            : handlePrimitive(tokens);
    return JsonSchema;
};
