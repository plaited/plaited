**@plaited/component** ( [Readme](../README.md) \| API )

***

[Plaited Typedocs](../../../modules.md) / [@plaited/component](../modules.md) / useMain

# Function: useMain()

> **useMain**(`context`, `trigger`): readonly [[`Send`](../type-aliases/Send.md), () => `void`]

Is a utility function to allow us to send and receive messages from the main thread in a worker

## Parameters

▪ **context**: `Window` & *typeof* `globalThis`

is self of the worker

▪ **trigger**: [`Trigger`](../../behavioral/type-aliases/Trigger.md)

## Returns

readonly [[`Send`](../type-aliases/Send.md), () => `void`]

## Source

[libs/component/src/use-main.ts:4](https://github.com/plaited/plaited/blob/95d1a1b/libs/component/src/use-main.ts#L4)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
