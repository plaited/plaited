**@plaited/token-transformer** ( [Readme](../README.md) \| API )

***

[Plaited Typedocs](../../../modules.md) / [@plaited/token-transformer](../modules.md) / defaultTSFormatters

# Function: defaultTSFormatters()

> **defaultTSFormatters**\<`T`, `F`\>(`token`, `details`): `string`

This formatter object will return formatters that will create content for
a treeshakeable mapping to css custom properties references to be used
inline styles in ts/js component files

## Type parameters

▪ **T** extends [`DesignTokenGroup`](../../../plaited/token/interfaces/DesignTokenGroup.md) = [`DesignTokenGroup`](../../../plaited/token/interfaces/DesignTokenGroup.md)

▪ **F** extends [`DesignToken`](../../../plaited/token/type-aliases/DesignToken.md) = [`DesignToken`](../../../plaited/token/type-aliases/DesignToken.md)

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

[types.ts:45](https://github.com/plaited/plaited/blob/b0dd907/libs/token-transformer/src/types.ts#L45)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
