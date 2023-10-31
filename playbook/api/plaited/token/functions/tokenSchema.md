**plaited** ( [Readme](../../README.md) \| API )

***

[Plaited Typedocs](../../../modules.md) / [plaited](../../modules.md) / [token](../README.md) / tokenSchema

# Function: tokenSchema()

> **tokenSchema**\<`T`\>(`__namedParameters`): `Promise`\<`void`\>

## Type parameters

▪ **T** extends [`DesignTokenGroup`](../interfaces/DesignTokenGroup.md) = [`DesignTokenGroup`](../interfaces/DesignTokenGroup.md)

## Parameters

▪ **\_\_namedParameters**: `object`

▪ **\_\_namedParameters.name?**: \`${string}.json\`

is the file name you want to use default to token-schema.json

▪ **\_\_namedParameters.output**: `string`

directory you want to write json schema too

▪ **\_\_namedParameters.tokens**: `T`

A object type [DesignTokenGroup](../interfaces/DesignTokenGroup.md)

## Returns

`Promise`\<`void`\>

## Source

libs/token-schema/dist/token-schema.d.ts:2

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
