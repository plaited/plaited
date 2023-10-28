[Plaited Typedocs](../README.md) / [Exports](../modules.md) / @plaited/comms

# Module: @plaited/comms

## Table of contents

### Functions

- [useIndexedDB](plaited_comms.md#useindexeddb)
- [useMain](plaited_comms.md#usemain)
- [useMessenger](plaited_comms.md#usemessenger)

## Functions

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

[use-indexed-db.ts:12](https://github.com/plaited/plaited/blob/5183ee2/libs/comms/src/use-indexed-db.ts#L12)

___

### useMain

▸ **useMain**(`context`, `trigger`): readonly [`Send`, () => `void`]

is a hook to allow us to send and receive messages from the main thread in a worker

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `context` | `Window` & typeof `globalThis` | is self of the worker |
| `trigger` | [`Trigger`](plaited.index.md#trigger) | - |

#### Returns

readonly [`Send`, () => `void`]

#### Defined in

[use-main.ts:5](https://github.com/plaited/plaited/blob/5183ee2/libs/comms/src/use-main.ts#L5)

___

### useMessenger

▸ **useMessenger**(): readonly [`Connect`, `Send`]

Enables communication between agents in a web app.
Agents can be Islands, workers, or behavioral program running in the main thread.
This allows for execution of the one-way message exchange pattern (aka
fire and forget).

#### Returns

readonly [`Connect`, `Send`]

readonly {}
  connect: (recipient: string, trigger: [Trigger](plaited.index.md#trigger)) => Disconnect,
  send: (recipient: string, detail: [TriggerArgs](plaited.index.md#triggerargs)) => void
  worker: (id: string, url: string) =>  Disconnect
}

#### Defined in

[use-messenger.ts:23](https://github.com/plaited/plaited/blob/5183ee2/libs/comms/src/use-messenger.ts#L23)
