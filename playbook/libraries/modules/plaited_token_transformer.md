[Plaited Typedocs](../README.md) / [Modules](../modules.md) / @plaited/token-transformer

# Module: @plaited/token-transformer

## Table of contents

### Functions

- [defaultCSSFormatters](plaited_token_transformer.md#defaultcssformatters)
- [defaultTSFormatters](plaited_token_transformer.md#defaulttsformatters)
- [tokenTransformer](plaited_token_transformer.md#tokentransformer)

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

token-types/dist/index.d.ts:319

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

token-types/dist/index.d.ts:319

___

### tokenTransformer

▸ **tokenTransformer**<`T`\>(`«destructured»`): `Promise`<`void`\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `DesignTokenGroup` = `DesignTokenGroup` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `«destructured»` | `Object` | - |
| › `baseFontSize?` | `number` | used for rem calculation default 20 |
| › `cssFormatters?` | `GetFormatters` | extend the cssFormatters by passing in custom formatter |
| › `output` | `string` | directory we want to write transformed token too |
| › `tokens` | `T` | an object of the type DesignTokenGroup |
| › `tsFormatters?` | `GetFormatters` | extend the tsFormatters by passing in custom formatter |

#### Returns

`Promise`<`void`\>

#### Defined in

[token-transformer/src/token-transformer.ts:6](https://github.com/plaited/plaited/blob/83e908b/libs/token-transformer/src/token-transformer.ts#L6)
