[Plaited Typedocs](../README.md) / [Exports](../modules.md) / @plaited/token-transformer

# Module: @plaited/token-transformer

## Table of contents

### Variables

- [defaultBaseFontSize](plaited_token_transformer.md#defaultbasefontsize)

### Functions

- [defaultCSSFormatters](plaited_token_transformer.md#defaultcssformatters)
- [defaultTSFormatters](plaited_token_transformer.md#defaulttsformatters)
- [transformCssTokens](plaited_token_transformer.md#transformcsstokens)
- [transformTsTokens](plaited_token_transformer.md#transformtstokens)

## Variables

### defaultBaseFontSize

• `Const` **defaultBaseFontSize**: ``20``

#### Defined in

[constants.ts:1](https://github.com/plaited/plaited/blob/e4e1a31/libs/token-transformer/src/constants.ts#L1)

## Functions

### defaultCSSFormatters

▸ **defaultCSSFormatters**<`T`, `F`\>(`token`, `details`): `string`

This formatter object will return formatters that will create content for an
optimized css stylesheet of css custom properties to be applied to :root

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `DesignTokenGroup` = `DesignTokenGroup` |
| `F` | extends `DesignToken` = `DesignToken` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `token` | `F` |
| `details` | `Object` |
| `details.allTokens` | `T` |
| `details.baseFontSize` | `number` |
| `details.colorSchemes?` | `ColorSchemes` |
| `details.containerQueries?` | `Queries` |
| `details.mediaQueries?` | `Queries` |
| `details.tokenPath` | `string`[] |

#### Returns

`string`

#### Defined in

[types.ts:42](https://github.com/plaited/plaited/blob/e4e1a31/libs/token-transformer/src/types.ts#L42)

___

### defaultTSFormatters

▸ **defaultTSFormatters**<`T`, `F`\>(`token`, `details`): `string`

This formatter object will return formatters that will create content for
a treeshakeable mapping to css custom properties references to be used
inline styles in ts/js component files

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `DesignTokenGroup` = `DesignTokenGroup` |
| `F` | extends `DesignToken` = `DesignToken` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `token` | `F` |
| `details` | `Object` |
| `details.allTokens` | `T` |
| `details.baseFontSize` | `number` |
| `details.colorSchemes?` | `ColorSchemes` |
| `details.containerQueries?` | `Queries` |
| `details.mediaQueries?` | `Queries` |
| `details.tokenPath` | `string`[] |

#### Returns

`string`

#### Defined in

[types.ts:42](https://github.com/plaited/plaited/blob/e4e1a31/libs/token-transformer/src/types.ts#L42)

___

### transformCssTokens

▸ **transformCssTokens**(`«destructured»`): `string`

#### Parameters

| Name | Type |
| :------ | :------ |
| `«destructured»` | `TransformerParams` |

#### Returns

`string`

#### Defined in

[transform-css-tokens.ts:26](https://github.com/plaited/plaited/blob/e4e1a31/libs/token-transformer/src/transform-css-tokens.ts#L26)

___

### transformTsTokens

▸ **transformTsTokens**(`«destructured»`): `string`

#### Parameters

| Name | Type |
| :------ | :------ |
| `«destructured»` | `TransformerParams` |

#### Returns

`string`

#### Defined in

[transform-ts-tokens.ts:6](https://github.com/plaited/plaited/blob/e4e1a31/libs/token-transformer/src/transform-ts-tokens.ts#L6)
