**@plaited/token-schema** ( [Readme](../README.md) \| API )

***

[Plaited Typedocs](../../../modules.md) / [@plaited/token-schema](../modules.md) / tokenSchema

# Function: tokenSchema()

> **tokenSchema**\<`T`\>(`tokens`): `Schema`

Parses a [DesignTokenGroup](../../../plaited/token/interfaces/DesignTokenGroup.md) group into a JSON schema where the tokens values
locked in as const.

## Type parameters

▪ **T** extends [`DesignTokenGroup`](../../../plaited/token/interfaces/DesignTokenGroup.md) = [`DesignTokenGroup`](../../../plaited/token/interfaces/DesignTokenGroup.md)

## Parameters

▪ **tokens**: `T`

The design token group to parse.

## Returns

`Schema`

The populated JSON schema.

## Source

[token-schema.ts:10](https://github.com/plaited/plaited/blob/b0dd907/libs/token-schema/src/token-schema.ts#L10)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
