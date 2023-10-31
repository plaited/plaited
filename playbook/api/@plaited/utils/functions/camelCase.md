**@plaited/utils** ( [Readme](../README.md) \| API )

***

[Plaited Typedocs](../../../modules.md) / [@plaited/utils](../modules.md) / camelCase

# Function: camelCase()

> **camelCase**(`str`): `string`

Converts a string to camel case.

## Parameters

▪ **str**: `string`

The input string to convert

## Returns

`string`

The input string converted to camel case

## Remarks

This function will handle strings in various formats:
- Hyphen-separated (kebab-case)
- Underscore-separated (snake_case)
- Slash-separated
- Space-separated (start case)
- Any combination of the above, with any number of consecutive separators

## Example

```ts
camelCase('hello---world') => 'helloWorld'
```

## Source

[cases.ts:16](https://github.com/plaited/plaited/blob/d85458a/libs/utils/src/cases.ts#L16)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
