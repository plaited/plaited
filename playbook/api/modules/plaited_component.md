[Plaited Typedocs](../README.md) / [Exports](../modules.md) / @plaited/component

# Module: @plaited/component

## Table of contents

### Interfaces

- [PlaitedElement](../interfaces/plaited_component.PlaitedElement.md)
- [PlaitedElementConstructor](../interfaces/plaited_component.PlaitedElementConstructor.md)

### Type Aliases

- [BroadcastMessage](plaited_component.md#broadcastmessage)
- [CreateComponent](plaited_component.md#createcomponent)
- [Plait](plaited_component.md#plait)
- [PlaitProps](plaited_component.md#plaitprops)
- [PlaitedComponent](plaited_component.md#plaitedcomponent)
- [PlaitedElementOptions](plaited_component.md#plaitedelementoptions)
- [Position](plaited_component.md#position)
- [SelectorMod](plaited_component.md#selectormod)
- [SendMessage](plaited_component.md#sendmessage)

### Functions

- [cc](plaited_component.md#cc)
- [createComponent](plaited_component.md#createcomponent-1)

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

[libs/component/src/types.ts:82](https://github.com/plaited/plaited/blob/d256361/libs/component/src/types.ts#L82)

___

### CreateComponent

Ƭ **CreateComponent**: (`{
  mode,
  delegatesFocus,
  tag,
  ...bProgramOptions
}`: [`PlaitedElementOptions`](plaited_component.md#plaitedelementoptions), `mixin?`: (`base`: [`PlaitedElementConstructor`](../interfaces/plaited_component.PlaitedElementConstructor.md)) => [`PlaitedElementConstructor`](../interfaces/plaited_component.PlaitedElementConstructor.md)) => [`PlaitedComponent`](plaited_component.md#plaitedcomponent)

#### Type declaration

▸ (`{
  mode,
  delegatesFocus,
  tag,
  ...bProgramOptions
}`, `mixin?`): [`PlaitedComponent`](plaited_component.md#plaitedcomponent)

##### Parameters

| Name | Type |
| :------ | :------ |
| `{
  mode,
  delegatesFocus,
  tag,
  ...bProgramOptions
}` | [`PlaitedElementOptions`](plaited_component.md#plaitedelementoptions) |
| `mixin?` | (`base`: [`PlaitedElementConstructor`](../interfaces/plaited_component.PlaitedElementConstructor.md)) => [`PlaitedElementConstructor`](../interfaces/plaited_component.PlaitedElementConstructor.md) |

##### Returns

[`PlaitedComponent`](plaited_component.md#plaitedcomponent)

#### Defined in

[libs/component/src/types.ts:92](https://github.com/plaited/plaited/blob/d256361/libs/component/src/types.ts#L92)

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

[libs/component/src/types.ts:11](https://github.com/plaited/plaited/blob/d256361/libs/component/src/types.ts#L11)

___

### PlaitProps

Ƭ **PlaitProps**: { `host`: [`PlaitedElement`](../interfaces/plaited_component.PlaitedElement.md) ; `$`: <T\>(`target`: `string`, `opts?`: { `all?`: ``false`` ; `mod?`: [`SelectorMod`](plaited_component.md#selectormod)  }) => `SugaredElement`<`T`\><T\>(`target`: `string`, `opts?`: { `all`: ``true`` ; `mod?`: [`SelectorMod`](plaited_component.md#selectormod)  }) => `SugaredElement`<`T`\>[]  } & `ReturnType`<typeof [`bProgram`](plaited.index.md#bprogram)\>

#### Defined in

[libs/component/src/types.ts:49](https://github.com/plaited/plaited/blob/d256361/libs/component/src/types.ts#L49)

___

### PlaitedComponent

Ƭ **PlaitedComponent**: `Object`

#### Call signature

▸ (): `void`

##### Returns

`void`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `tag` | `string` |

#### Defined in

[libs/component/src/types.ts:87](https://github.com/plaited/plaited/blob/d256361/libs/component/src/types.ts#L87)

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

[libs/component/src/types.ts:13](https://github.com/plaited/plaited/blob/d256361/libs/component/src/types.ts#L13)

___

### Position

Ƭ **Position**: ``"beforebegin"`` \| ``"afterbegin"`` \| ``"beforeend"`` \| ``"afterend"``

#### Defined in

[libs/component/src/types.ts:85](https://github.com/plaited/plaited/blob/d256361/libs/component/src/types.ts#L85)

___

### SelectorMod

Ƭ **SelectorMod**: ``"="`` \| ``"~="`` \| ``"|="`` \| ``"^="`` \| ``"$="`` \| ``"*="``

#### Defined in

[libs/component/src/types.ts:48](https://github.com/plaited/plaited/blob/d256361/libs/component/src/types.ts#L48)

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

[libs/component/src/types.ts:81](https://github.com/plaited/plaited/blob/d256361/libs/component/src/types.ts#L81)

## Functions

### cc

▸ **cc**(`«destructured»`, `mixin?`): [`PlaitedComponent`](plaited_component.md#plaitedcomponent)

This function is an alias for [createComponent](plaited_component.md#createcomponent-1).

#### Parameters

| Name | Type |
| :------ | :------ |
| `«destructured»` | [`PlaitedElementOptions`](plaited_component.md#plaitedelementoptions) |
| `mixin?` | (`base`: [`PlaitedElementConstructor`](../interfaces/plaited_component.PlaitedElementConstructor.md)) => [`PlaitedElementConstructor`](../interfaces/plaited_component.PlaitedElementConstructor.md) |

#### Returns

[`PlaitedComponent`](plaited_component.md#plaitedcomponent)

**`Function`**

**`See`**

[createComponent](plaited_component.md#createcomponent-1)

#### Defined in

[libs/component/src/types.ts:92](https://github.com/plaited/plaited/blob/d256361/libs/component/src/types.ts#L92)

___

### createComponent

▸ **createComponent**(`«destructured»`, `mixin?`): [`PlaitedComponent`](plaited_component.md#plaitedcomponent)

A typescript function for instantiating PlaitedElements

#### Parameters

| Name | Type |
| :------ | :------ |
| `«destructured»` | [`PlaitedElementOptions`](plaited_component.md#plaitedelementoptions) |
| `mixin?` | (`base`: [`PlaitedElementConstructor`](../interfaces/plaited_component.PlaitedElementConstructor.md)) => [`PlaitedElementConstructor`](../interfaces/plaited_component.PlaitedElementConstructor.md) |

#### Returns

[`PlaitedComponent`](plaited_component.md#plaitedcomponent)

#### Defined in

[libs/component/src/types.ts:92](https://github.com/plaited/plaited/blob/d256361/libs/component/src/types.ts#L92)
