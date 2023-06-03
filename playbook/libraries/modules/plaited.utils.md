[Plaited Typedocs](../README.md) / [Modules](../modules.md) / [plaited](plaited.md) / utils

# Module: utils

## Table of contents

### Type Aliases

- [KeyMirror](plaited.utils.md#keymirror)
- [Publisher](plaited.utils.md#publisher)
- [ValueOf](plaited.utils.md#valueof)

### Functions

- [callAll](plaited.utils.md#callall)
- [canUseDOM](plaited.utils.md#canusedom)
- [debounce](plaited.utils.md#debounce)
- [deepEqual](plaited.utils.md#deepequal)
- [escape](plaited.utils.md#escape)
- [generateId](plaited.utils.md#generateid)
- [hashString](plaited.utils.md#hashstring)
- [keyMirror](plaited.utils.md#keymirror-1)
- [noop](plaited.utils.md#noop)
- [opacityHex](plaited.utils.md#opacityhex)
- [parseToRgb](plaited.utils.md#parsetorgb)
- [publisher](plaited.utils.md#publisher-1)
- [setIdCounter](plaited.utils.md#setidcounter)
- [trueTypeOf](plaited.utils.md#truetypeof)
- [ueid](plaited.utils.md#ueid)
- [unescape](plaited.utils.md#unescape)
- [wait](plaited.utils.md#wait)

## Type Aliases

### KeyMirror

Ƭ **KeyMirror**<`Keys`\>: { readonly [K in Keys[number]]: K }

#### Type parameters

| Name | Type |
| :------ | :------ |
| `Keys` | extends `string`[] |

#### Defined in

node_modules/@plaited/utils/dist/key-mirror.d.ts:1

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

node_modules/@plaited/utils/dist/publisher.d.ts:1

___

### ValueOf

Ƭ **ValueOf**<`T`\>: `T`[keyof `T`]

#### Type parameters

| Name |
| :------ |
| `T` |

#### Defined in

node_modules/@plaited/utils/dist/value-of.type.d.ts:1

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

node_modules/@plaited/utils/dist/call-all.d.ts:2

___

### canUseDOM

▸ **canUseDOM**(): `boolean`

#### Returns

`boolean`

#### Defined in

node_modules/@plaited/utils/dist/can-use-dom.d.ts:1

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

node_modules/@plaited/utils/dist/debounce.d.ts:1

___

### deepEqual

▸ **deepEqual**(`objA`, `objB`, `map?`): `boolean`

#### Parameters

| Name | Type |
| :------ | :------ |
| `objA` | `unknown` |
| `objB` | `unknown` |
| `map?` | `WeakMap`<`object`, `any`\> |

#### Returns

`boolean`

#### Defined in

node_modules/@plaited/utils/dist/deep-equal.d.ts:1

___

### escape

▸ **escape**(`sub`): `any`

**`Desription`**

escapes a string

**`Example`**

```ts
escape('&<>\'"') => '&amp;&lt;&gt;&#39;&quot;'
```

#### Parameters

| Name | Type |
| :------ | :------ |
| `sub` | `string` |

#### Returns

`any`

#### Defined in

node_modules/@plaited/utils/dist/escape-unescape.d.ts:10

___

### generateId

▸ **generateId**(`prefix?`): `string`

For when you need id but are cool with just bumping a global counter

#### Parameters

| Name | Type |
| :------ | :------ |
| `prefix?` | `string` |

#### Returns

`string`

#### Defined in

node_modules/@plaited/utils/dist/id.d.ts:6

___

### hashString

▸ **hashString**(`str`): `number`

**`Summary`**

djb2 hashing function

#### Parameters

| Name | Type |
| :------ | :------ |
| `str` | `string` |

#### Returns

`number`

#### Defined in

node_modules/@plaited/utils/dist/hash.d.ts:4

___

### keyMirror

▸ **keyMirror**<`Keys`\>(`...inputs`): `Readonly`<[`KeyMirror`](plaited.utils.md#keymirror)<`Keys`\>\>

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

`Readonly`<[`KeyMirror`](plaited.utils.md#keymirror)<`Keys`\>\>

#### Defined in

node_modules/@plaited/utils/dist/key-mirror.d.ts:5

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

node_modules/@plaited/utils/dist/noop.d.ts:2

___

### opacityHex

▸ **opacityHex**(): `Map`<`number`, `string`\>

generates a map where you can pass in an opacity number and get back the corresponding 2 digit hex value

#### Returns

`Map`<`number`, `string`\>

#### Defined in

node_modules/@plaited/utils/dist/opacity-hex.d.ts:2

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

node_modules/@plaited/utils/dist/parse-to-rgb.d.ts:2

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

node_modules/@plaited/utils/dist/publisher.d.ts:5

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

node_modules/@plaited/utils/dist/id.d.ts:8

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

node_modules/@plaited/utils/dist/true-type-of.d.ts:2

___

### ueid

▸ **ueid**(`prefix?`): `string`

**`Description`**

a function for returning an unique enough id when you need it

#### Parameters

| Name | Type |
| :------ | :------ |
| `prefix?` | `string` |

#### Returns

`string`

#### Defined in

node_modules/@plaited/utils/dist/id.d.ts:4

___

### unescape

▸ **unescape**(`sub`): `any`

**`Desription`**

unescapes an escaped a string

**`Example`**

```ts
unescape('&amp;&lt;&gt;&#39;&quot;') => '&<>\'"'
```

#### Parameters

| Name | Type |
| :------ | :------ |
| `sub` | `string` |

#### Returns

`any`

#### Defined in

node_modules/@plaited/utils/dist/escape-unescape.d.ts:16

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

node_modules/@plaited/utils/dist/wait.d.ts:2
