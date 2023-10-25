[Plaited Typedocs](../README.md) / [Exports](../modules.md) / @plaited/utils

# Module: @plaited/utils

## Table of contents

### Type Aliases

- [KeyMirror](plaited_utils.md#keymirror)
- [Publisher](plaited_utils.md#publisher)
- [ValueOf](plaited_utils.md#valueof)

### Functions

- [callAll](plaited_utils.md#callall)
- [camelCase](plaited_utils.md#camelcase)
- [canUseDOM](plaited_utils.md#canusedom)
- [debounce](plaited_utils.md#debounce)
- [deepEqual](plaited_utils.md#deepequal)
- [escape](plaited_utils.md#escape)
- [generateId](plaited_utils.md#generateid)
- [hashString](plaited_utils.md#hashstring)
- [kebabCase](plaited_utils.md#kebabcase)
- [keyMirror](plaited_utils.md#keymirror-1)
- [noop](plaited_utils.md#noop)
- [opacityHex](plaited_utils.md#opacityhex)
- [parseToRgb](plaited_utils.md#parsetorgb)
- [publisher](plaited_utils.md#publisher-1)
- [setIdCounter](plaited_utils.md#setidcounter)
- [trueTypeOf](plaited_utils.md#truetypeof)
- [ueid](plaited_utils.md#ueid)
- [unescape](plaited_utils.md#unescape)
- [wait](plaited_utils.md#wait)

## Type Aliases

### KeyMirror

Ƭ **KeyMirror**<`Keys`\>: { readonly [K in Keys[number]]: K }

#### Type parameters

| Name | Type |
| :------ | :------ |
| `Keys` | extends `string`[] |

#### Defined in

[key-mirror.ts:1](https://github.com/plaited/plaited/blob/06d3d55/libs/utils/src/key-mirror.ts#L1)

___

### Publisher

Ƭ **Publisher**<`T`\>: () => (`value`: `T`) => `void`

#### Type parameters

| Name |
| :------ |
| `T` |

#### Type declaration

▸ (): (`value`: `T`) => `void`

##### Returns

`fn`

▸ (`value`): `void`

##### Parameters

| Name | Type |
| :------ | :------ |
| `value` | `T` |

##### Returns

`void`

| Name | Type |
| :------ | :------ |
| `subscribe` | (`listener`: (`msg`: `T`) => `void`) => () => `boolean` |

#### Defined in

[publisher.ts:1](https://github.com/plaited/plaited/blob/06d3d55/libs/utils/src/publisher.ts#L1)

___

### ValueOf

Ƭ **ValueOf**<`T`\>: `T`[keyof `T`]

#### Type parameters

| Name |
| :------ |
| `T` |

#### Defined in

[value-of.type.ts:1](https://github.com/plaited/plaited/blob/06d3d55/libs/utils/src/value-of.type.ts#L1)

## Functions

### callAll

▸ **callAll**<`F`\>(`...fns`): (...`args`: `Parameters`<`F`\>) => `void`

Call all function passed in with the same arguments when invoked

#### Type parameters

| Name | Type |
| :------ | :------ |
| `F` | extends (...`args`: `Parameters`<`F`\>) => `ReturnType`<`F`\> |

#### Parameters

| Name | Type |
| :------ | :------ |
| `...fns` | `F`[] |

#### Returns

`fn`

▸ (`...args`): `void`

##### Parameters

| Name | Type |
| :------ | :------ |
| `...args` | `Parameters`<`F`\> |

##### Returns

`void`

#### Defined in

[call-all.ts:5](https://github.com/plaited/plaited/blob/06d3d55/libs/utils/src/call-all.ts#L5)

___

### camelCase

▸ **camelCase**(`str`): `string`

Converts a string to camel case.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `str` | `string` | The input string to convert |

#### Returns

`string`

The input string converted to camel case

**`Remarks`**

This function will handle strings in various formats:
- Hyphen-separated (kebab-case)
- Underscore-separated (snake_case)
- Slash-separated 
- Space-separated (start case)
- Any combination of the above, with any number of consecutive separators

#### Defined in

[cases.ts:15](https://github.com/plaited/plaited/blob/06d3d55/libs/utils/src/cases.ts#L15)

___

### canUseDOM

▸ **canUseDOM**(): `boolean`

#### Returns

`boolean`

#### Defined in

[can-use-dom.ts:1](https://github.com/plaited/plaited/blob/06d3d55/libs/utils/src/can-use-dom.ts#L1)

___

### debounce

▸ **debounce**<`F`\>(`func`, `waitFor`): (...`args`: `Parameters`<`F`\>) => `void`

#### Type parameters

| Name | Type |
| :------ | :------ |
| `F` | extends (...`args`: `Parameters`<`F`\>) => `ReturnType`<`F`\> |

#### Parameters

| Name | Type |
| :------ | :------ |
| `func` | `F` |
| `waitFor` | `number` |

#### Returns

`fn`

▸ (`...args`): `void`

##### Parameters

| Name | Type |
| :------ | :------ |
| `...args` | `Parameters`<`F`\> |

##### Returns

`void`

#### Defined in

[debounce.ts:1](https://github.com/plaited/plaited/blob/06d3d55/libs/utils/src/debounce.ts#L1)

___

### deepEqual

▸ **deepEqual**(`objA`, `objB`, `map?`): `boolean`

#### Parameters

| Name | Type |
| :------ | :------ |
| `objA` | `unknown` |
| `objB` | `unknown` |
| `map` | `WeakMap`<`object`, `any`\> |

#### Returns

`boolean`

#### Defined in

[deep-equal.ts:1](https://github.com/plaited/plaited/blob/06d3d55/libs/utils/src/deep-equal.ts#L1)

___

### escape

▸ **escape**(`sub`): `any`

#### Parameters

| Name | Type |
| :------ | :------ |
| `sub` | `string` |

#### Returns

`any`

**`Desription`**

escapes a string

**`Example`**

```ts
escape('&<>\'"') => '&amp;&lt;&gt;&#39;&quot;'
```

#### Defined in

[escape-unescape.ts:37](https://github.com/plaited/plaited/blob/06d3d55/libs/utils/src/escape-unescape.ts#L37)

___

### generateId

▸ **generateId**(`prefix?`): `string`

For when you need id but are cool with just bumping a global counter

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `prefix` | `string` | `''` |

#### Returns

`string`

#### Defined in

[id.ts:13](https://github.com/plaited/plaited/blob/06d3d55/libs/utils/src/id.ts#L13)

___

### hashString

▸ **hashString**(`str`): `number`

#### Parameters

| Name | Type |
| :------ | :------ |
| `str` | `string` |

#### Returns

`number`

**`Summary`**

djb2 hashing function

#### Defined in

[hash.ts:4](https://github.com/plaited/plaited/blob/06d3d55/libs/utils/src/hash.ts#L4)

___

### kebabCase

▸ **kebabCase**(`str`): `string`

Converts a string to kebab case.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `str` | `string` | The input string to convert |

#### Returns

`string`

The input string converted to kebab case

**`Remarks`**

This function will handle strings in various formats:
- CamelCase
- Underscore-separated (snake_case)
- Backslash-separated
- Space-separated (start case)
- Any combination of the above, with any number of consecutive separators

#### Defined in

[cases.ts:37](https://github.com/plaited/plaited/blob/06d3d55/libs/utils/src/cases.ts#L37)

___

### keyMirror

▸ **keyMirror**<`Keys`\>(`...inputs`): `Readonly`<[`KeyMirror`](plaited_utils.md#keymirror)<`Keys`\>\>

create an object who's keys and values are the same by simply passing in the keys as arguments

#### Type parameters

| Name | Type |
| :------ | :------ |
| `Keys` | extends `string`[] |

#### Parameters

| Name | Type |
| :------ | :------ |
| `...inputs` | `Keys` |

#### Returns

`Readonly`<[`KeyMirror`](plaited_utils.md#keymirror)<`Keys`\>\>

#### Defined in

[key-mirror.ts:6](https://github.com/plaited/plaited/blob/06d3d55/libs/utils/src/key-mirror.ts#L6)

___

### noop

▸ **noop**<`T`\>(`..._`): `void`

no-op function good for when you need defaults and stubs

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | `never` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `..._` | `T`[] |

#### Returns

`void`

#### Defined in

[noop.ts:3](https://github.com/plaited/plaited/blob/06d3d55/libs/utils/src/noop.ts#L3)

___

### opacityHex

▸ **opacityHex**(): `Map`<`number`, `string`\>

generates a map where you can pass in an opacity number and get back the corresponding 2 digit hex value

#### Returns

`Map`<`number`, `string`\>

#### Defined in

[opacity-hex.ts:2](https://github.com/plaited/plaited/blob/06d3d55/libs/utils/src/opacity-hex.ts#L2)

___

### parseToRgb

▸ **parseToRgb**(`hex`): `string`

parse a hex code to an rgb(a) value

#### Parameters

| Name | Type |
| :------ | :------ |
| `hex` | `string` |

#### Returns

`string`

#### Defined in

[parse-to-rgb.ts:4](https://github.com/plaited/plaited/blob/06d3d55/libs/utils/src/parse-to-rgb.ts#L4)

___

### publisher

▸ **publisher**<`T`\>(): (`value`: `T`) => `void`

#### Type parameters

| Name |
| :------ |
| `T` |

#### Returns

`fn`

▸ (`value`): `void`

##### Parameters

| Name | Type |
| :------ | :------ |
| `value` | `T` |

##### Returns

`void`

| Name | Type |
| :------ | :------ |
| `subscribe` | (`listener`: (`msg`: `T`) => `void`) => () => `boolean` |

#### Defined in

[publisher.ts:5](https://github.com/plaited/plaited/blob/06d3d55/libs/utils/src/publisher.ts#L5)

___

### setIdCounter

▸ **setIdCounter**(`num`): `void`

reset or set the global idCounter

#### Parameters

| Name | Type |
| :------ | :------ |
| `num` | `number` |

#### Returns

`void`

#### Defined in

[id.ts:18](https://github.com/plaited/plaited/blob/06d3d55/libs/utils/src/id.ts#L18)

___

### trueTypeOf

▸ **trueTypeOf**(`obj?`): `string`

get the true type of an object returned back to you as a string

#### Parameters

| Name | Type |
| :------ | :------ |
| `obj?` | `unknown` |

#### Returns

`string`

#### Defined in

[true-type-of.ts:2](https://github.com/plaited/plaited/blob/06d3d55/libs/utils/src/true-type-of.ts#L2)

___

### ueid

▸ **ueid**(`prefix?`): `string`

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `prefix` | `string` | `''` |

#### Returns

`string`

**`Description`**

a function for returning an unique enough id when you need it

#### Defined in

[id.ts:4](https://github.com/plaited/plaited/blob/06d3d55/libs/utils/src/id.ts#L4)

___

### unescape

▸ **unescape**(`sub`): `any`

#### Parameters

| Name | Type |
| :------ | :------ |
| `sub` | `string` |

#### Returns

`any`

**`Desription`**

unescapes an escaped a string

**`Example`**

```ts
unescape('&amp;&lt;&gt;&#39;&quot;') => '&<>\'"'
```

#### Defined in

[escape-unescape.ts:49](https://github.com/plaited/plaited/blob/06d3d55/libs/utils/src/escape-unescape.ts#L49)

___

### wait

▸ **wait**(`ms`): `Promise`<`unknown`\>

an async function that will wait the given time passed to it in ms

#### Parameters

| Name | Type |
| :------ | :------ |
| `ms` | `number` |

#### Returns

`Promise`<`unknown`\>

#### Defined in

[wait.ts:2](https://github.com/plaited/plaited/blob/06d3d55/libs/utils/src/wait.ts#L2)
