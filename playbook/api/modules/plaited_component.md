[Plaited Typedocs](../README.md) / [Exports](../modules.md) / @plaited/component

# Module: @plaited/component

## Table of contents

### Interfaces

- [PlaitedElement](../interfaces/plaited_component.PlaitedElement.md)
- [PlaitedElementConstructor](../interfaces/plaited_component.PlaitedElementConstructor.md)

### Type Aliases

- [BroadcastMessage](plaited_component.md#broadcastmessage)
- [Plait](plaited_component.md#plait)
- [PlaitProps](plaited_component.md#plaitprops)
- [PlaitedElementOptions](plaited_component.md#plaitedelementoptions)
- [Position](plaited_component.md#position)
- [SendMessage](plaited_component.md#sendmessage)

### Functions

- [cc](plaited_component.md#cc)
- [createComponent](plaited_component.md#createcomponent)

## Type Aliases

### BroadcastMessage

Ƭ **BroadcastMessage**: (`recipient`: [`TriggerArgs`](plaited.index.md#triggerargs)) => `void`

#### Type declaration

▸ (`recipient`): `void`

##### Parameters

| Name | Type |
| :------ | :------ |
| `recipient` | [`TriggerArgs`](plaited.index.md#triggerargs) |

##### Returns

`void`

#### Defined in

[libs/component/src/types.ts:74](https://github.com/plaited/plaited/blob/65db093/libs/component/src/types.ts#L74)

___

### Plait

Ƭ **Plait**: (`props`: [`PlaitProps`](plaited_component.md#plaitprops)) => `void` \| `Promise`<`void`\>

#### Type declaration

▸ (`props`): `void` \| `Promise`<`void`\>

##### Parameters

| Name | Type |
| :------ | :------ |
| `props` | [`PlaitProps`](plaited_component.md#plaitprops) |

##### Returns

`void` \| `Promise`<`void`\>

#### Defined in

[libs/component/src/types.ts:11](https://github.com/plaited/plaited/blob/65db093/libs/component/src/types.ts#L11)

___

### PlaitProps

Ƭ **PlaitProps**: { `host`: [`PlaitedElement`](../interfaces/plaited_component.PlaitedElement.md) ; `$`: <T\>(`target`: `string`) => `SugaredElement`<`T`\><T\>(`target`: `string`, `opts?`: { `all`: `boolean` ; `mod`: ``"="`` \| ``"~="`` \| ``"|="`` \| ``"^="`` \| ``"$="`` \| ``"*="``  }) => `SugaredElement`<`T`\>[]  } & `ReturnType`<typeof [`bProgram`](plaited.index.md#bprogram)\>

#### Defined in

[libs/component/src/types.ts:48](https://github.com/plaited/plaited/blob/65db093/libs/component/src/types.ts#L48)

___

### PlaitedElementOptions

Ƭ **PlaitedElementOptions**: `Object`

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `connect?` | (`recipient`: `string`, `trigger`: [`Trigger`](plaited.index.md#trigger)) => () => `void` | messenger connect callback |
| `delegatesFocus?` | `boolean` | configure whether to delegate focus or not **`Default Value`** ```ts 'true' ``` |
| `dev?` | [`DevCallback`](../interfaces/plaited.index.DevCallback.md) | logger function to receive messages from behavioral program react streams |
| `id?` | `boolean` | set to true if we wish to use id when connecting to messenger to receive messages from other islands |
| `mode?` | ``"open"`` \| ``"closed"`` | define wether island's custom element is open or closed. **`Default Value`** ```ts 'open' ``` |
| `strategy?` | [`Strategy`](plaited.index.md#strategy) | event selection strategy callback from behavioral library |
| `tag` | \`${string}-${string}\` | the element tag you want to use |

#### Defined in

[libs/component/src/types.ts:13](https://github.com/plaited/plaited/blob/65db093/libs/component/src/types.ts#L13)

___

### Position

Ƭ **Position**: ``"beforebegin"`` \| ``"afterbegin"`` \| ``"beforeend"`` \| ``"afterend"``

#### Defined in

[libs/component/src/types.ts:77](https://github.com/plaited/plaited/blob/65db093/libs/component/src/types.ts#L77)

___

### SendMessage

Ƭ **SendMessage**: (`recipient`: `string`, `detail`: [`TriggerArgs`](plaited.index.md#triggerargs)) => `void`

#### Type declaration

▸ (`recipient`, `detail`): `void`

##### Parameters

| Name | Type |
| :------ | :------ |
| `recipient` | `string` |
| `detail` | [`TriggerArgs`](plaited.index.md#triggerargs) |

##### Returns

`void`

#### Defined in

[libs/component/src/types.ts:73](https://github.com/plaited/plaited/blob/65db093/libs/component/src/types.ts#L73)

## Functions

### cc

▸ **cc**(`«destructured»`, `mixin?`): () => `void`

This function is an alias for [createComponent](plaited_component.md#createcomponent).

#### Parameters

| Name | Type |
| :------ | :------ |
| `«destructured»` | [`PlaitedElementOptions`](plaited_component.md#plaitedelementoptions) |
| `mixin` | (`base`: [`PlaitedElementConstructor`](../interfaces/plaited_component.PlaitedElementConstructor.md)) => [`PlaitedElementConstructor`](../interfaces/plaited_component.PlaitedElementConstructor.md) |

#### Returns

`fn`

▸ (): `void`

##### Returns

`void`

| Name | Type |
| :------ | :------ |
| `tag` | `string` |

**`Function`**

**`See`**

[createComponent](plaited_component.md#createcomponent)

#### Defined in

[libs/component/src/create-component.ts:80](https://github.com/plaited/plaited/blob/65db093/libs/component/src/create-component.ts#L80)

___

### createComponent

▸ **createComponent**(`«destructured»`, `mixin?`): () => `void`

A typescript function for instantiating PlaitedElements

#### Parameters

| Name | Type |
| :------ | :------ |
| `«destructured»` | [`PlaitedElementOptions`](plaited_component.md#plaitedelementoptions) |
| `mixin` | (`base`: [`PlaitedElementConstructor`](../interfaces/plaited_component.PlaitedElementConstructor.md)) => [`PlaitedElementConstructor`](../interfaces/plaited_component.PlaitedElementConstructor.md) |

#### Returns

`fn`

▸ (): `void`

##### Returns

`void`

| Name | Type |
| :------ | :------ |
| `tag` | `string` |

#### Defined in

[libs/component/src/create-component.ts:80](https://github.com/plaited/plaited/blob/65db093/libs/component/src/create-component.ts#L80)
