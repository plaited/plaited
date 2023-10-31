**@plaited/utils** ( [Readme](../README.md) \| API )

***

[Plaited Typedocs](../../../modules.md) / [@plaited/utils](../modules.md) / kebabCase

# Function: kebabCase()

> **kebabCase**(`str`): `string`

Converts a string to kebab case.

## Parameters

▪ **str**: `string`

The input string to convert

## Returns

`string`

The input string converted to kebab case

## Remarks

This function will handle strings in various formats:
- CamelCase
- Underscore-separated (snake_case)
- Backslash-separated
- Space-separated (start case)
- Any combination of the above, with any number of consecutive separators

## Example

```ts
kebabCase('hello///world') => 'hello-world'
```

## Source

[cases.ts:41](https://github.com/plaited/plaited/blob/b0dd907/libs/utils/src/cases.ts#L41)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
