[Plaited Typedocs](../README.md) / [Exports](../modules.md) / @plaited/token-schema

# Module: @plaited/token-schema

## Table of contents

### Functions

- [tokenSchema](plaited_token_schema.md#tokenschema)

## Functions

### tokenSchema

▸ **tokenSchema**<`T`\>(`«destructured»`): `Promise`<`void`\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `DesignTokenGroup` = `DesignTokenGroup` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `«destructured»` | `Object` | - |
| › `name?` | \`${string}.json\` | is the file name you want to use default to token-schema.json |
| › `output` | `string` | directory you want to write json schema too |
| › `tokens` | `T` | A object type DesignTokenGroup |

#### Returns

`Promise`<`void`\>

#### Defined in

[token-schema.ts:5](https://github.com/plaited/plaited/blob/5b1c95d/libs/token-schema/src/token-schema.ts#L5)
