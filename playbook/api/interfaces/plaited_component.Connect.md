[Plaited Typedocs](../README.md) / [Exports](../modules.md) / [@plaited/component](../modules/plaited_component.md) / Connect

# Interface: Connect

[@plaited/component](../modules/plaited_component.md).Connect

## Callable

### Connect

▸ **Connect**(`recipient`, `trigger`): () => `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `recipient` | `string` |
| `trigger` | [`Trigger`](../modules/plaited_behavioral.md#trigger) |

#### Returns

`fn`

▸ (): `void`

##### Returns

`void`

#### Defined in

[libs/component/src/types.ts:12](https://github.com/plaited/plaited/blob/39779d0/libs/component/src/types.ts#L12)

## Table of contents

### Properties

- [worker](plaited_component.Connect.md#worker)

## Properties

### worker

• **worker**: (`id`: `string`, `worker`: `Worker`) => () => `void`

#### Type declaration

▸ (`id`, `worker`): () => `void`

##### Parameters

| Name | Type |
| :------ | :------ |
| `id` | `string` |
| `worker` | `Worker` |

##### Returns

`fn`

▸ (): `void`

##### Returns

`void`

#### Defined in

[libs/component/src/types.ts:13](https://github.com/plaited/plaited/blob/39779d0/libs/component/src/types.ts#L13)
