**@plaited/utils** ( [Readme](../README.md) \| API )

***

[Plaited Typedocs](../../../modules.md) / [@plaited/utils](../modules.md) / useStore

# Function: useStore()

> **useStore**\<`T`\>(`initialStore`?): readonly [`Get`\<`T`\>, `Set`\<`T`\>]

## Type parameters

▪ **T**

## Parameters

▪ **initialStore?**: `T`

## Returns

readonly [`Get`\<`T`\>, `Set`\<`T`\>]

## Description

A simple utility function for safely getting and setting values you need to persist during run.
When using the callback feature userStore passes a structured clone of the currently stored value
as a parameter. If you pass a function as nestStore, it will be treated as an updater function.
It must be pure, should take the previous store value as its only argument,
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

[use-store.ts:29](https://github.com/plaited/plaited/blob/b151218/libs/utils/src/use-store.ts#L29)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
