[Plaited Typedocs](../README.md) / [Exports](../modules.md) / [@plaited/rite](../modules/plaited_rite.md) / [index](../modules/plaited_rite.index.md) / Assertion

# Interface: Assertion

[@plaited/rite](../modules/plaited_rite.md).[index](../modules/plaited_rite.index.md).Assertion

## Callable

### Assertion

▸ **Assertion**<`T`\>(`param`): `void`

#### Type parameters

| Name |
| :------ |
| `T` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `param` | `Object` |
| `param.actual` | `T` |
| `param.expected` | `T` |
| `param.given` | `string` |
| `param.should` | `string` |

#### Returns

`void`

#### Defined in

[libs/rite/src/assert.ts:9](https://github.com/plaited/plaited/blob/8821045/libs/rite/src/assert.ts#L9)

## Table of contents

### Properties

- [findByAttribute](plaited_rite.index.Assertion.md#findbyattribute)
- [findByText](plaited_rite.index.Assertion.md#findbytext)
- [fireEvent](plaited_rite.index.Assertion.md#fireevent)
- [match](plaited_rite.index.Assertion.md#match)
- [throws](plaited_rite.index.Assertion.md#throws)
- [wait](plaited_rite.index.Assertion.md#wait)

## Properties

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

[libs/rite/src/assert.ts:15](https://github.com/plaited/plaited/blob/8821045/libs/rite/src/assert.ts#L15)

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

[libs/rite/src/assert.ts:16](https://github.com/plaited/plaited/blob/8821045/libs/rite/src/assert.ts#L16)

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

[libs/rite/src/assert.ts:17](https://github.com/plaited/plaited/blob/8821045/libs/rite/src/assert.ts#L17)

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

[libs/rite/src/assert.ts:18](https://github.com/plaited/plaited/blob/8821045/libs/rite/src/assert.ts#L18)

___

### throws

• **throws**: `Throws`

#### Defined in

[libs/rite/src/assert.ts:19](https://github.com/plaited/plaited/blob/8821045/libs/rite/src/assert.ts#L19)

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

[libs/rite/src/assert.ts:20](https://github.com/plaited/plaited/blob/8821045/libs/rite/src/assert.ts#L20)
