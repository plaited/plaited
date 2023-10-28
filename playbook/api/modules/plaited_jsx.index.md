[Plaited Typedocs](../README.md) / [Exports](../modules.md) / [@plaited/jsx](plaited_jsx.md) / index

# Module: index

## Table of contents

### References

- [h](plaited_jsx.index.md#h)

### Interfaces

- [AdditionalAttrs](../interfaces/plaited_jsx.index.AdditionalAttrs.md)
- [CreateTemplate](../interfaces/plaited_jsx.index.CreateTemplate.md)

### Type Aliases

- [Attrs](plaited_jsx.index.md#attrs)
- [BaseAttrs](plaited_jsx.index.md#baseattrs)
- [Child](plaited_jsx.index.md#child)
- [Children](plaited_jsx.index.md#children)
- [FT](plaited_jsx.index.md#ft)
- [FunctionTemplate](plaited_jsx.index.md#functiontemplate)
- [Primitive](plaited_jsx.index.md#primitive)
- [Template](plaited_jsx.index.md#template)

### Variables

- [booleanAttrs](plaited_jsx.index.md#booleanattrs)
- [dataTarget](plaited_jsx.index.md#datatarget)
- [dataTrigger](plaited_jsx.index.md#datatrigger)
- [primitives](plaited_jsx.index.md#primitives)
- [validPrimitiveChildren](plaited_jsx.index.md#validprimitivechildren)
- [voidTags](plaited_jsx.index.md#voidtags)

### Functions

- [Fragment](plaited_jsx.index.md#fragment)
- [classNames](plaited_jsx.index.md#classnames)
- [createTemplate](plaited_jsx.index.md#createtemplate)
- [css](plaited_jsx.index.md#css)
- [memo](plaited_jsx.index.md#memo)
- [ssr](plaited_jsx.index.md#ssr)
- [stylesheets](plaited_jsx.index.md#stylesheets)

## References

### h

Renames and re-exports [createTemplate](plaited_jsx.index.md#createtemplate)

## Type Aliases

### Attrs

Ƭ **Attrs**<`T`\>: [`BaseAttrs`](plaited_jsx.index.md#baseattrs) & `T`

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`AdditionalAttrs`](../interfaces/plaited_jsx.index.AdditionalAttrs.md) = [`AdditionalAttrs`](../interfaces/plaited_jsx.index.AdditionalAttrs.md) |

#### Defined in

[types.ts:41](https://github.com/plaited/plaited/blob/ff359c1/libs/jsx/src/types.ts#L41)

___

### BaseAttrs

Ƭ **BaseAttrs**: `Object`

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `children?` | [`Children`](plaited_jsx.index.md#children) | - |
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

[types.ts:23](https://github.com/plaited/plaited/blob/ff359c1/libs/jsx/src/types.ts#L23)

___

### Child

Ƭ **Child**: `string` \| [`Template`](plaited_jsx.index.md#template)

#### Defined in

[types.ts:15](https://github.com/plaited/plaited/blob/ff359c1/libs/jsx/src/types.ts#L15)

___

### Children

Ƭ **Children**: [`Child`](plaited_jsx.index.md#child)[] \| [`Child`](plaited_jsx.index.md#child)

#### Defined in

[types.ts:17](https://github.com/plaited/plaited/blob/ff359c1/libs/jsx/src/types.ts#L17)

___

### FT

Ƭ **FT**<`T`\>: [`FunctionTemplate`](plaited_jsx.index.md#functiontemplate)<`T`\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `Record`<`string`, `any`\> = `Record`<`string`, `any`\> |

#### Defined in

[types.ts:54](https://github.com/plaited/plaited/blob/ff359c1/libs/jsx/src/types.ts#L54)

___

### FunctionTemplate

Ƭ **FunctionTemplate**<`T`\>: (`attrs`: `T` & [`BaseAttrs`](plaited_jsx.index.md#baseattrs)) => [`Template`](plaited_jsx.index.md#template)

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `Record`<`string`, `any`\> = `Record`<`string`, `any`\> |

#### Type declaration

▸ (`attrs`): [`Template`](plaited_jsx.index.md#template)

##### Parameters

| Name | Type |
| :------ | :------ |
| `attrs` | `T` & [`BaseAttrs`](plaited_jsx.index.md#baseattrs) |

##### Returns

[`Template`](plaited_jsx.index.md#template)

#### Defined in

[types.ts:47](https://github.com/plaited/plaited/blob/ff359c1/libs/jsx/src/types.ts#L47)

___

### Primitive

Ƭ **Primitive**: ``null`` \| `undefined` \| `number` \| `string` \| `boolean` \| `bigint`

#### Defined in

[types.ts:2](https://github.com/plaited/plaited/blob/ff359c1/libs/jsx/src/types.ts#L2)

___

### Template

Ƭ **Template**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `content` | `string` |
| `stylesheets` | `Set`<`string`\> |

#### Defined in

[types.ts:10](https://github.com/plaited/plaited/blob/ff359c1/libs/jsx/src/types.ts#L10)

## Variables

### booleanAttrs

• `Const` **booleanAttrs**: `Set`<`string`\>

boolean attributes

#### Defined in

[constants.ts:40](https://github.com/plaited/plaited/blob/ff359c1/libs/jsx/src/constants.ts#L40)

___

### dataTarget

• `Const` **dataTarget**: ``"data-target"``

attribute used to manipulate a dom element

#### Defined in

[constants.ts:2](https://github.com/plaited/plaited/blob/ff359c1/libs/jsx/src/constants.ts#L2)

___

### dataTrigger

• `Const` **dataTrigger**: ``"data-trigger"``

attribute used to wire a dom element to the islands event listener

#### Defined in

[constants.ts:4](https://github.com/plaited/plaited/blob/ff359c1/libs/jsx/src/constants.ts#L4)

___

### primitives

• `Const` **primitives**: `Set`<`string`\>

#### Defined in

[constants.ts:67](https://github.com/plaited/plaited/blob/ff359c1/libs/jsx/src/constants.ts#L67)

___

### validPrimitiveChildren

• `Const` **validPrimitiveChildren**: `Set`<`string`\>

#### Defined in

[constants.ts:76](https://github.com/plaited/plaited/blob/ff359c1/libs/jsx/src/constants.ts#L76)

___

### voidTags

• `Const` **voidTags**: `Set`<`string`\>

void attributes

#### Defined in

[constants.ts:6](https://github.com/plaited/plaited/blob/ff359c1/libs/jsx/src/constants.ts#L6)

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

[create-template.ts:230](https://github.com/plaited/plaited/blob/ff359c1/libs/jsx/src/create-template.ts#L230)

___

### classNames

▸ **classNames**(`...classes`): `string`

takes an array of conditional css class name strings and returns them concatenated

#### Parameters

| Name | Type |
| :------ | :------ |
| `...classes` | `ClassNameProps` |

#### Returns

`string`

#### Defined in

[class-names.ts:3](https://github.com/plaited/plaited/blob/ff359c1/libs/jsx/src/class-names.ts#L3)

___

### createTemplate

▸ **createTemplate**<`T`\>(`tag`, `attrs`): [`Template`](plaited_jsx.index.md#template)

createTemplate function used for ssr

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`AdditionalAttrs`](../interfaces/plaited_jsx.index.AdditionalAttrs.md) |

#### Parameters

| Name | Type |
| :------ | :------ |
| `tag` | `Tag` |
| `attrs` | [`Attrs`](plaited_jsx.index.md#attrs)<`T`\> |

#### Returns

[`Template`](plaited_jsx.index.md#template)

#### Defined in

[types.ts:64](https://github.com/plaited/plaited/blob/ff359c1/libs/jsx/src/types.ts#L64)

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

[css.ts:61](https://github.com/plaited/plaited/blob/ff359c1/libs/jsx/src/css.ts#L61)

___

### memo

▸ **memo**<`T`\>(`resultFn`): [`FT`](plaited_jsx.index.md#ft)<`T`\>

Forked from  memoize-one
(c) Alexander Reardon - MIT
{@see https://github.com/alexreardon/memoize-one}
In this mode we constrain arguments to a single props object that extends TemplateProps
We also do a basic shallow comparison on the object to cache function result.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `Record`<`string`, `any`\> = `Record`<`string`, `any`\> |

#### Parameters

| Name | Type |
| :------ | :------ |
| `resultFn` | [`FT`](plaited_jsx.index.md#ft)<`T`\> |

#### Returns

[`FT`](plaited_jsx.index.md#ft)<`T`\>

#### Defined in

[memo.ts:29](https://github.com/plaited/plaited/blob/ff359c1/libs/jsx/src/memo.ts#L29)

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

[ssr.ts:3](https://github.com/plaited/plaited/blob/ff359c1/libs/jsx/src/ssr.ts#L3)

___

### stylesheets

▸ **stylesheets**(`...sheets`): `Object`

takes an array of conditional stylesheet objects and returns a stylesheet 
object with each individual sheet in an array

#### Parameters

| Name | Type |
| :------ | :------ |
| `...sheets` | `StylesheetsProps` |

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `stylesheet` | `any`[] |

#### Defined in

[stylesheets.ts:4](https://github.com/plaited/plaited/blob/ff359c1/libs/jsx/src/stylesheets.ts#L4)
