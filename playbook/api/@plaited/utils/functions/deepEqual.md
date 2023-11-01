**@plaited/utils** ( [Readme](../README.md) \| API )

***

[Plaited Typedocs](../../../modules.md) / [@plaited/utils](../modules.md) / deepEqual

# Function: deepEqual()

> **deepEqual**(`objA`, `objB`, `map`): `boolean`

Determines if two objects are deeply equal.

## Parameters

▪ **objA**: `unknown`

The first object to compare.

▪ **objB**: `unknown`

The second object to compare.

▪ **map**: `WeakMap`\<`object`, `any`\>= `undefined`

A WeakMap used to solve the circular reference problem.

## Returns

`boolean`

A boolean indicating whether the two objects are deeply equal.

## Example

```ts
deepEqual(['array'], ['array']) => true
```

## Source

[deep-equal.ts:9](https://github.com/plaited/plaited/blob/317e868/libs/utils/src/deep-equal.ts#L9)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
