**@plaited/utils** ( [Readme](../README.md) \| API )

***

[Plaited Typedocs](../../../modules.md) / [@plaited/utils](../modules.md) / debounce

# Function: debounce()

> **debounce**\<`F`\>(`func`, `waitFor`): (...`args`) => `void`

Returns a debounced version of the provided function that delays its execution until the specified time has elapsed since the last time it was called.

## Type parameters

▪ **F** extends (...`args`) => `ReturnType`\<`F`\>

## Parameters

▪ **func**: `F`

The function to debounce.

▪ **waitFor**: `number`

The number of milliseconds to wait before executing the debounced function.

## Returns

`function`

A debounced version of the provided function.

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
> [debounce.ts:13](https://github.com/plaited/plaited/blob/b0dd907/libs/utils/src/debounce.ts#L13)
>

## Example

```ts
const debounced = debounce(console.log('hi'), 100)
debounced() // => 'hi' (after 100ms)
```

## Source

[debounce.ts:10](https://github.com/plaited/plaited/blob/b0dd907/libs/utils/src/debounce.ts#L10)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
