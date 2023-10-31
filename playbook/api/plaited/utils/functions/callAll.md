**plaited** ( [Readme](../../README.md) \| API )

***

[Plaited Typedocs](../../../modules.md) / [plaited](../../modules.md) / [utils](../README.md) / callAll

# Function: callAll()

> **callAll**\<`F`\>(...`fns`): (...`args`) => `void`

Calls all the given functions with the same arguments and returns nothing.
If a function is not actually a function, it is skipped.

## Type parameters

▪ **F** extends (...`args`) => `ReturnType`\<`F`\>

## Parameters

▪ ...**fns**: `F`[]

The functions to call.

## Returns

`function`

Nothing.

> > (...`args`): `void`
>
> ### Parameters
>
> ▪ ...**args**: `Parameters`\<`F`\>
>
> ### Returns
>
> `void`
>
> ### Source
>
> libs/utils/dist/call-all.d.ts:8
>

## Source

libs/utils/dist/call-all.d.ts:8

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
