**plaited** ( [Readme](../../README.md) \| API )

***

[Plaited Typedocs](../../../modules.md) / [plaited](../../modules.md) / [index](../README.md) / bProgram

# Function: bProgram()

> **bProgram**(`options`?): `Readonly`\<`object`\>

Creates a behavioral program that manages the execution of behavioral threads.

## Parameters

▪ **options?**: `object`

An object containing optional parameters for the program.

▪ **options.dev?**: [`DevCallback`](../interfaces/DevCallback.md)

A callback function that receives a stream of state snapshots, last selected event, and trigger.

▪ **options.strategy?**: `"priority"` \| `"randomized"` \| `"chaos"` \| [`Strategy`](../type-aliases/Strategy.md)

The event selection strategy to use. Defaults to `strategies.priority`.

## Returns

`Readonly`\<`object`\>

An object containing methods for managing the program and executing behavioral threads.

## Source

libs/behavioral/dist/b-program.d.ts:10

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
