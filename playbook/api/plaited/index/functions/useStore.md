**plaited** ( [Readme](../../README.md) \| API )

***

[Plaited Typedocs](../../../modules.md) / [plaited](../../modules.md) / [index](../README.md) / useStore

# Function: useStore()

> **useStore**\<`T`\>(`initialStore`?): readonly [`Get`\<`T`\>, `Set`\<`T`\>]

## Type parameters

▪ **T**

## Parameters

▪ **initialStore?**: `T`

## Returns

readonly [`Get`\<`T`\>, `Set`\<`T`\>]

## Description

a simple utility function for safely getting and setting values you need to persist during run.
When using the callback feature userStore passes a structured clone of the currently stored value
as a parameter. If you pass a function as nestStore, it will be treated as an updater function. It must be pure, should take the pending state as its only argument,
and should return the next store.

## Example

```ts
const [store, setStore] = useStore<Record<string, number> | number>({ a: 1 })
 setStore((prev) => {
   if (typeof prev !== 'number') prev.b = 2
   return prev
 })
 store() //=> { a: 1, b: 2 }
 setStore(3)
 store() // => 3
```

## Source

libs/utils/dist/use-store.d.ts:23

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
