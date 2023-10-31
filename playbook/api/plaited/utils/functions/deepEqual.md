**plaited** ( [Readme](../../README.md) \| API )

***

[Plaited Typedocs](../../../modules.md) / [plaited](../../modules.md) / [utils](../README.md) / deepEqual

# Function: deepEqual()

> **deepEqual**(`objA`, `objB`, `map`?): `boolean`

Determines if two objects are deeply equal.

## Parameters

▪ **objA**: `unknown`

The first object to compare.

▪ **objB**: `unknown`

The second object to compare.

▪ **map?**: `WeakMap`\<`object`, `any`\>

A WeakMap used to solve the circular reference problem.

## Returns

`boolean`

A boolean indicating whether the two objects are deeply equal.

## Example

```ts
deepEqual(['array'], ['array']) => true
```

## Source

libs/utils/dist/deep-equal.d.ts:9

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
