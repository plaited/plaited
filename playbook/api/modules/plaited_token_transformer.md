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

[constants.ts:1](https://github.com/plaited/plaited/blob/a5f0a82/libs/token-transformer/src/constants.ts#L1)

## Functions

### defaultCSSFormatters

▸ **defaultCSSFormatters**<`T`, `F`\>(`args`): `string`

This formatter object will return formatters that will create content for an
optimized css stylesheet of css custom properties to be applied to :root

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `DesignTokenGroup` = `DesignTokenGroup` |
| `F` | extends `$FormatterValue` = `$FormatterValue` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `args` | `Object` |
| `args.$type` | `string` |
| `args.$value` | `F` |
| `args.allTokens` | `T` |
| `args.baseFontSize` | `number` |
| `args.tokenPath` | `string`[] |

#### Returns

`string`

#### Defined in

[types.ts:11](https://github.com/plaited/plaited/blob/a5f0a82/libs/token-transformer/src/types.ts#L11)

___

### defaultTSFormatters

▸ **defaultTSFormatters**<`T`, `F`\>(`args`): `string`

This formatter object will return formatters that will create content for
a treeshakeable mapping to css custom properties references to be used
inline styles in ts/js component files

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `DesignTokenGroup` = `DesignTokenGroup` |
| `F` | extends `$FormatterValue` = `$FormatterValue` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `args` | `Object` |
| `args.$type` | `string` |
| `args.$value` | `F` |
| `args.allTokens` | `T` |
| `args.baseFontSize` | `number` |
| `args.tokenPath` | `string`[] |

#### Returns

`string`

#### Defined in

[types.ts:11](https://github.com/plaited/plaited/blob/a5f0a82/libs/token-transformer/src/types.ts#L11)

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

[transform-css-tokens.ts:26](https://github.com/plaited/plaited/blob/a5f0a82/libs/token-transformer/src/transform-css-tokens.ts#L26)

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

[transform-ts-tokens.ts:6](https://github.com/plaited/plaited/blob/a5f0a82/libs/token-transformer/src/transform-ts-tokens.ts#L6)
