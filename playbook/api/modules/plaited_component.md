[Plaited Typedocs](../README.md) / [Exports](../modules.md) / @plaited/component

# Module: @plaited/component

## Table of contents

### Interfaces

- [$](../interfaces/plaited_component._.md)
- [Connect](../interfaces/plaited_component.Connect.md)
- [PlaitedElement](../interfaces/plaited_component.PlaitedElement.md)
- [PlaitedElementConstructor](../interfaces/plaited_component.PlaitedElementConstructor.md)

### Type Aliases

- [ComponentArgs](plaited_component.md#componentargs)
- [Message](plaited_component.md#message)
- [PlaitProps](plaited_component.md#plaitprops)
- [SelectorMod](plaited_component.md#selectormod)
- [Send](plaited_component.md#send)

### Functions

- [Component](plaited_component.md#component)
- [useIndexedDB](plaited_component.md#useindexeddb)
- [useMain](plaited_component.md#usemain)
- [useMessenger](plaited_component.md#usemessenger)

## Type Aliases

### ComponentArgs

Ƭ **ComponentArgs**: `Object`

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `connect?` | [`Connect`](../interfaces/plaited_component.Connect.md) | Messenger connect callback from useMessenger |
| `delegatesFocus?` | `boolean` | configure whether to delegate focus or not **`Default Value`** ```ts 'true' ``` |
| `dev?` | ``true`` \| [`DevCallback`](../interfaces/plaited_behavioral.DevCallback.md) | logger function to receive messages from behavioral program react streams |
| `mode?` | ``"open"`` \| ``"closed"`` | define wether island's custom element is open or closed. **`Default Value`** ```ts 'open' ``` |
| `observedTriggers?` | `Record`<`string`, `string`\> | the element tag you want to use |
| `strategy?` | [`Strategy`](plaited_behavioral.md#strategy) | event selection strategy callback from behavioral library |
| `tag` | \`${string}-${string}\` | PlaitedComponent tag name |
| `template` | [`Template`](plaited_jsx.index.md#template) | Optional Plaited Component shadow dom template |

#### Defined in

[libs/component/src/types.ts:84](https://github.com/plaited/plaited/blob/39779d0/libs/component/src/types.ts#L84)

___

### Message

Ƭ **Message**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `detail` | [`TriggerArgs`](plaited_behavioral.md#triggerargs) |
| `recipient` | `string` |

#### Defined in

[libs/component/src/types.ts:16](https://github.com/plaited/plaited/blob/39779d0/libs/component/src/types.ts#L16)

___

### PlaitProps

Ƭ **PlaitProps**: { `$`: [`$`](../interfaces/plaited_component._.md) ; `host`: [`PlaitedElement`](../interfaces/plaited_component.PlaitedElement.md)  } & `ReturnType`<typeof [`bProgram`](plaited_behavioral.md#bprogram)\>

#### Defined in

[libs/component/src/types.ts:63](https://github.com/plaited/plaited/blob/39779d0/libs/component/src/types.ts#L63)

___

### SelectorMod

Ƭ **SelectorMod**: ``"="`` \| ``"~="`` \| ``"|="`` \| ``"^="`` \| ``"$="`` \| ``"*="``

#### Defined in

[libs/component/src/types.ts:22](https://github.com/plaited/plaited/blob/39779d0/libs/component/src/types.ts#L22)

___

### Send

Ƭ **Send**: (`recipient`: `string`, `detail`: [`TriggerArgs`](plaited_behavioral.md#triggerargs)) => `void`

#### Type declaration

▸ (`recipient`, `detail`): `void`

##### Parameters

| Name | Type |
| :------ | :------ |
| `recipient` | `string` |
| `detail` | [`TriggerArgs`](plaited_behavioral.md#triggerargs) |

##### Returns

`void`

#### Defined in

[libs/component/src/types.ts:15](https://github.com/plaited/plaited/blob/39779d0/libs/component/src/types.ts#L15)

## Functions

### Component

▸ **Component**(`«destructured»`): typeof `PlaitedComponent`

#### Parameters

| Name | Type |
| :------ | :------ |
| `«destructured»` | [`ComponentArgs`](plaited_component.md#componentargs) |

#### Returns

typeof `PlaitedComponent`

#### Defined in

[libs/component/src/component.ts:76](https://github.com/plaited/plaited/blob/39779d0/libs/component/src/component.ts#L76)

___

### useIndexedDB

▸ **useIndexedDB**<`T`\>(`key`, `initialValue?`, `option?`): `Promise`<readonly [`Get`<`T`\>, `Set`<`T`\>]\>

asynchronously get and set indexed db values

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | `unknown` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `key` | `string` | key for stored value |
| `initialValue?` | `T` | initial value can be null |
| `option?` | `Object` | you can actually pass it an reference to another indexedDB |
| `option.databaseName` | `string` | - |
| `option.storeName` | `string` | - |

#### Returns

`Promise`<readonly [`Get`<`T`\>, `Set`<`T`\>]\>

#### Defined in

[libs/component/src/use-indexed-db.ts:12](https://github.com/plaited/plaited/blob/39779d0/libs/component/src/use-indexed-db.ts#L12)

___

### useMain

▸ **useMain**(`context`, `trigger`): readonly [[`Send`](plaited_component.md#send), () => `void`]

is a hook to allow us to send and receive messages from the main thread in a worker

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `context` | `Window` & typeof `globalThis` | is self of the worker |
| `trigger` | [`Trigger`](plaited_behavioral.md#trigger) | - |

#### Returns

readonly [[`Send`](plaited_component.md#send), () => `void`]

#### Defined in

[libs/component/src/use-main.ts:4](https://github.com/plaited/plaited/blob/39779d0/libs/component/src/use-main.ts#L4)

___

### useMessenger

▸ **useMessenger**(`id?`): `Readonly`<{ `connect`: [`Connect`](../interfaces/plaited_component.Connect.md) ; `has`: (`recipient`: `string`) => `boolean` ; `send`: [`Send`](plaited_component.md#send)  }\>

Enables communication between agents in a web app.
Agents can be Islands, workers, or behavioral program running in the main thread.
This allows for execution of the one-way message exchange pattern (aka
fire and forget).

#### Parameters

| Name | Type |
| :------ | :------ |
| `id?` | `string` |

#### Returns

`Readonly`<{ `connect`: [`Connect`](../interfaces/plaited_component.Connect.md) ; `has`: (`recipient`: `string`) => `boolean` ; `send`: [`Send`](plaited_component.md#send)  }\>

readonly {}
  connect: (recipient: string, trigger: [Trigger](plaited_behavioral.md#trigger)) => Disconnect,
  send: (recipient: string, detail: [TriggerArgs](plaited_behavioral.md#triggerargs)) => void
  worker: (id: string, url: string) =>  Disconnect
}

#### Defined in

[libs/component/src/use-messenger.ts:13](https://github.com/plaited/plaited/blob/39779d0/libs/component/src/use-messenger.ts#L13)
