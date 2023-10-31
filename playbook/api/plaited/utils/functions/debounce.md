**plaited** ( [Readme](../../README.md) \| API )

***

[Plaited Typedocs](../../../modules.md) / [plaited](../../modules.md) / [utils](../README.md) / debounce

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
> libs/utils/dist/debounce.d.ts:10
>

## Example

```ts
const debounced = debounce(console.log('hi'), 100)
debounced() // => 'hi' (after 100ms)
```

## Source

libs/utils/dist/debounce.d.ts:10

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
