[Plaited Typedocs](../README.md) / [Modules](../modules.md) / [@plaited/rite](plaited_rite.md) / [index](plaited_rite.index.md) / assert

# Namespace: assert

[@plaited/rite](plaited_rite.md).[index](plaited_rite.index.md).assert

## Table of contents

### Variables

- [findByAttribute](plaited_rite.index.assert.md#findbyattribute)
- [findByText](plaited_rite.index.assert.md#findbytext)
- [fireEvent](plaited_rite.index.assert.md#fireevent)
- [match](plaited_rite.index.assert.md#match)
- [throws](plaited_rite.index.assert.md#throws)
- [wait](plaited_rite.index.assert.md#wait)

## Variables

### findByAttribute

• **findByAttribute**: <T\>(`attributeName`: `string`, `attributeValue`: `string` \| `RegExp`, `context?`: `HTMLElement` \| `SVGElement`) => `Promise`<`T`\>

#### Type declaration

▸ <`T`\>(`attributeName`, `attributeValue`, `context?`): `Promise`<`T`\>

##### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `HTMLElement` \| `SVGElement` = `HTMLElement` \| `SVGElement` |

##### Parameters

| Name | Type |
| :------ | :------ |
| `attributeName` | `string` |
| `attributeValue` | `string` \| `RegExp` |
| `context?` | `HTMLElement` \| `SVGElement` |

##### Returns

`Promise`<`T`\>

#### Defined in

[libs/rite/src/assert.ts:61](https://github.com/plaited/plaited/blob/20ae0c7/libs/rite/src/assert.ts#L61)

___

### findByText

• **findByText**: <T\>(`searchText`: `string` \| `RegExp`, `context?`: `HTMLElement`) => `Promise`<`T`\>

#### Type declaration

▸ <`T`\>(`searchText`, `context?`): `Promise`<`T`\>

##### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `HTMLElement`<`T`\> = `HTMLElement` |

##### Parameters

| Name | Type |
| :------ | :------ |
| `searchText` | `string` \| `RegExp` |
| `context?` | `HTMLElement` |

##### Returns

`Promise`<`T`\>

#### Defined in

[libs/rite/src/assert.ts:62](https://github.com/plaited/plaited/blob/20ae0c7/libs/rite/src/assert.ts#L62)

___

### fireEvent

• **fireEvent**: <T\>(`element`: `T`, `eventName`: `string`, `options`: `EventArguments`) => `Promise`<`void`\>

#### Type declaration

▸ <`T`\>(`element`, `eventName`, `options?`): `Promise`<`void`\>

##### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `HTMLElement` \| `SVGElement` = `HTMLElement` \| `SVGElement` |

##### Parameters

| Name | Type |
| :------ | :------ |
| `element` | `T` |
| `eventName` | `string` |
| `options` | `EventArguments` |

##### Returns

`Promise`<`void`\>

#### Defined in

[libs/rite/src/assert.ts:63](https://github.com/plaited/plaited/blob/20ae0c7/libs/rite/src/assert.ts#L63)

___

### match

• **match**: (`str`: `string`) => (`pattern`: `string` \| `RegExp`) => `string`

#### Type declaration

▸ (`str`): (`pattern`: `string` \| `RegExp`) => `string`

##### Parameters

| Name | Type |
| :------ | :------ |
| `str` | `string` |

##### Returns

`fn`

▸ (`pattern`): `string`

##### Parameters

| Name | Type |
| :------ | :------ |
| `pattern` | `string` \| `RegExp` |

##### Returns

`string`

#### Defined in

[libs/rite/src/assert.ts:58](https://github.com/plaited/plaited/blob/20ae0c7/libs/rite/src/assert.ts#L58)

___

### throws

• **throws**: `Throws`

#### Defined in

[libs/rite/src/assert.ts:59](https://github.com/plaited/plaited/blob/20ae0c7/libs/rite/src/assert.ts#L59)

___

### wait

• **wait**: (`ms`: `number`) => `Promise`<`unknown`\>

#### Type declaration

▸ (`ms`): `Promise`<`unknown`\>

an async function that will wait the given time passed to it in ms

##### Parameters

| Name | Type |
| :------ | :------ |
| `ms` | `number` |

##### Returns

`Promise`<`unknown`\>

#### Defined in

[libs/rite/src/assert.ts:60](https://github.com/plaited/plaited/blob/20ae0c7/libs/rite/src/assert.ts#L60)
