**plaited** ( [Readme](../../README.md) \| API )

***

[Plaited Typedocs](../../../modules.md) / [plaited](../../modules.md) / [token](../README.md) / transformCssTokens

# Function: transformCssTokens()

> **transformCssTokens**(`params`): `string`

Transforms design tokens into CSS rules with deduplicated selectors on :host.
These rules are to be used with design token custom element and applied to
it's shadow root's constructable stylesheet.

## Parameters

▪ **params**: `TransformerParams`

The parameters for the transformation.

## Returns

`string`

The transformed CSS rules with deduplicated selectors.

## Source

libs/token-transformer/dist/transform-css-tokens.d.ts:9

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
