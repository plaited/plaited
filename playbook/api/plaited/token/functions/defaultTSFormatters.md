**plaited** ( [Readme](../../README.md) \| API )

***

[Plaited Typedocs](../../../modules.md) / [plaited](../../modules.md) / [token](../README.md) / defaultTSFormatters

# Function: defaultTSFormatters()

> **defaultTSFormatters**\<`T`, `F`\>(`token`, `details`): `string`

This formatter object will return formatters that will create content for
a treeshakeable mapping to css custom properties references to be used
inline styles in ts/js component files

## Type parameters

▪ **T** extends [`DesignTokenGroup`](../interfaces/DesignTokenGroup.md) = [`DesignTokenGroup`](../interfaces/DesignTokenGroup.md)

▪ **F** extends [`DesignToken`](../type-aliases/DesignToken.md) = [`DesignToken`](../type-aliases/DesignToken.md)

## Parameters

▪ **token**: `F`

▪ **details**: `object`

▪ **details.allTokens**: `T`

▪ **details.baseFontSize**: `number`

▪ **details.colorSchemes?**: `ColorSchemes`

▪ **details.containerQueries?**: `Queries`

▪ **details.mediaQueries?**: `Queries`

▪ **details.tokenPath**: `string`[]

## Returns

`string`

## Source

libs/token-transformer/dist/types.d.ts:36

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
