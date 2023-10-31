**@plaited/component** ( [Readme](../README.md) \| API )

***

[Plaited Typedocs](../../../modules.md) / [@plaited/component](../modules.md) / Connect

# Interface: Connect()

> **Connect**(`recipient`, `trigger`): () => `void`

## Contents

- [Parameters](Connect.md#parameters)
- [Returns](Connect.md#returns)
  - [Returns](Connect.md#returns-1)
  - [Source](Connect.md#source)
- [Source](Connect.md#source-1)
- [Properties](Connect.md#properties)
  - [worker](Connect.md#worker)

## Parameters

▪ **recipient**: `string`

▪ **trigger**: [`Trigger`](../../behavioral/type-aliases/Trigger.md)

## Returns

`function`

> > (): `void`
>
> ### Returns
>
> `void`
>
> ### Source
>
> [libs/component/src/types.ts:6](https://github.com/plaited/plaited/blob/0d4801d/libs/component/src/types.ts#L6)
>

## Source

[libs/component/src/types.ts:6](https://github.com/plaited/plaited/blob/0d4801d/libs/component/src/types.ts#L6)

## Properties

### worker

> **worker**: (`id`, `worker`) => () => `void`

#### Parameters

▪ **id**: `string`

▪ **worker**: `Worker`

#### Returns

`function`

> > (): `void`
>
> ##### Returns
>
> `void`
>
> ##### Source
>
> [libs/component/src/types.ts:7](https://github.com/plaited/plaited/blob/0d4801d/libs/component/src/types.ts#L7)
>

#### Source

[libs/component/src/types.ts:7](https://github.com/plaited/plaited/blob/0d4801d/libs/component/src/types.ts#L7)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
