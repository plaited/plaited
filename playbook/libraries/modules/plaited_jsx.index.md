[Plaited Typedocs](../README.md) / [Modules](../modules.md) / [@plaited/jsx](plaited_jsx.md) / index

# Module: index

## Table of contents

### Interfaces

- [CreateTemplate](../interfaces/plaited_jsx.index.CreateTemplate.md)

### Type Aliases

- [Attrs](plaited_jsx.index.md#attrs)
- [BaseAttrs](plaited_jsx.index.md#baseattrs)
- [Children](plaited_jsx.index.md#children)
- [PlaitedElement](plaited_jsx.index.md#plaitedelement)
- [Primitive](plaited_jsx.index.md#primitive)
- [Template](plaited_jsx.index.md#template)

### Variables

- [dataTarget](plaited_jsx.index.md#datatarget)
- [dataTrigger](plaited_jsx.index.md#datatrigger)

### Functions

- [Fragment](plaited_jsx.index.md#fragment)
- [createTemplate](plaited_jsx.index.md#createtemplate)
- [css](plaited_jsx.index.md#css)
- [ssr](plaited_jsx.index.md#ssr)

## Type Aliases

### Attrs

Ƭ **Attrs**<`T`\>: [`BaseAttrs`](plaited_jsx.index.md#baseattrs) & `T`

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `Record`<`string`, `any`\> = `Record`<`string`, `any`\> |

#### Defined in

[types.ts:34](https://github.com/plaited/plaited/blob/7bbcbfa/libs/jsx/src/types.ts#L34)

___

### BaseAttrs

Ƭ **BaseAttrs**: `Object`

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `class?` | `never` | - |
| `className?` | `string` | - |
| `data-target?` | `string` | - |
| `data-trigger?` | `Record`<`string`, `string`\> | - |
| `for?` | `never` | - |
| `htmlFor?` | `string` | - |
| `key?` | `string` | - |
| `shadowrootdelegatesfocus?` | `boolean` | - |
| `shadowrootmode?` | ``"open"`` \| ``"closed"`` | - |
| `slots?` | [`Children`](plaited_jsx.index.md#children) | - |
| `style?` | `Record`<`string`, `string`\> | - |
| `stylesheet?` | `string` \| `string`[] | - |
| `trusted?` | `boolean` | setting trusted to true will disable all escaping security policy measures for this element template |

#### Defined in

[types.ts:17](https://github.com/plaited/plaited/blob/7bbcbfa/libs/jsx/src/types.ts#L17)

___

### Children

Ƭ **Children**: (`string` \| [`Template`](plaited_jsx.index.md#template))[] \| `string` \| [`Template`](plaited_jsx.index.md#template)

#### Defined in

[types.ts:15](https://github.com/plaited/plaited/blob/7bbcbfa/libs/jsx/src/types.ts#L15)

___

### PlaitedElement

Ƭ **PlaitedElement**<`T`\>: (`attrs`: [`Attrs`](plaited_jsx.index.md#attrs)<`T`\>) => [`Template`](plaited_jsx.index.md#template)

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `Record`<`string`, `any`\> = `Record`<`string`, `any`\> |

#### Type declaration

▸ (`attrs`): [`Template`](plaited_jsx.index.md#template)

##### Parameters

| Name | Type |
| :------ | :------ |
| `attrs` | [`Attrs`](plaited_jsx.index.md#attrs)<`T`\> |

##### Returns

[`Template`](plaited_jsx.index.md#template)

#### Defined in

[types.ts:43](https://github.com/plaited/plaited/blob/7bbcbfa/libs/jsx/src/types.ts#L43)

___

### Primitive

Ƭ **Primitive**: ``null`` \| `undefined` \| `number` \| `string` \| `boolean` \| `bigint`

#### Defined in

[types.ts:2](https://github.com/plaited/plaited/blob/7bbcbfa/libs/jsx/src/types.ts#L2)

___

### Template

Ƭ **Template**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `content` | `string` |
| `stylesheets` | `Set`<`string`\> |

#### Defined in

[types.ts:10](https://github.com/plaited/plaited/blob/7bbcbfa/libs/jsx/src/types.ts#L10)

## Variables

### dataTarget

• `Const` **dataTarget**: ``"data-target"``

attribute used to manipulate a dom element

#### Defined in

[constants.ts:2](https://github.com/plaited/plaited/blob/7bbcbfa/libs/jsx/src/constants.ts#L2)

___

### dataTrigger

• `Const` **dataTrigger**: ``"data-trigger"``

attribute used to wire a dom element to the islands event listener

#### Defined in

[constants.ts:4](https://github.com/plaited/plaited/blob/7bbcbfa/libs/jsx/src/constants.ts#L4)

## Functions

### Fragment

▸ **Fragment**(`«destructured»`): `Object`

#### Parameters

| Name | Type |
| :------ | :------ |
| `«destructured»` | [`Attrs`](plaited_jsx.index.md#attrs) |

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `content` | `string` |
| `stylesheets` | `Set`<`string`\> |

#### Defined in

[create-template.ts:235](https://github.com/plaited/plaited/blob/7bbcbfa/libs/jsx/src/create-template.ts#L235)

___

### createTemplate

▸ **createTemplate**<`T`\>(`tag`, `attrs`): [`Template`](plaited_jsx.index.md#template)

createTemplate function used for ssr

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `Record`<`string`, `any`\> |

#### Parameters

| Name | Type |
| :------ | :------ |
| `tag` | `Tag` |
| `attrs` | [`Attrs`](plaited_jsx.index.md#attrs)<`T`\> |

#### Returns

[`Template`](plaited_jsx.index.md#template)

#### Defined in

[types.ts:53](https://github.com/plaited/plaited/blob/7bbcbfa/libs/jsx/src/types.ts#L53)

___

### css

▸ **css**(`strings`, `...expressions`): readonly [`Record`<`string`, `string`\>, { `stylesheet`: `string`  }]

tagged template function for creating css module style styles and classNames objects

#### Parameters

| Name | Type |
| :------ | :------ |
| `strings` | `TemplateStringsArray` |
| `...expressions` | ([`Primitive`](plaited_jsx.index.md#primitive) \| [`Primitive`](plaited_jsx.index.md#primitive)[])[] |

#### Returns

readonly [`Record`<`string`, `string`\>, { `stylesheet`: `string`  }]

#### Defined in

[css.ts:63](https://github.com/plaited/plaited/blob/7bbcbfa/libs/jsx/src/css.ts#L63)

___

### ssr

▸ **ssr**(`...templates`): `string`

#### Parameters

| Name | Type |
| :------ | :------ |
| `...templates` | [`Template`](plaited_jsx.index.md#template)[] |

#### Returns

`string`

#### Defined in

[ssr.ts:3](https://github.com/plaited/plaited/blob/7bbcbfa/libs/jsx/src/ssr.ts#L3)
