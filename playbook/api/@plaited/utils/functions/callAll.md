**@plaited/utils** ( [Readme](../README.md) \| API )

***

[Plaited Typedocs](../../../modules.md) / [@plaited/utils](../modules.md) / callAll

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
> [call-all.ts:11](https://github.com/plaited/plaited/blob/317e868/libs/utils/src/call-all.ts#L11)
>

## Source

[call-all.ts:10](https://github.com/plaited/plaited/blob/317e868/libs/utils/src/call-all.ts#L10)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
