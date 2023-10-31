**plaited** ( [Readme](../../README.md) \| API )

***

[Plaited Typedocs](../../../modules.md) / [plaited](../../modules.md) / [token](../README.md) / defaultCSSFormatters

# Function: defaultCSSFormatters()

> **defaultCSSFormatters**\<`T`, `F`\>(`token`, `details`): `string`

This formatter object will return formatters that will create content for an
optimized css stylesheet of css custom properties to be applied to :root

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
