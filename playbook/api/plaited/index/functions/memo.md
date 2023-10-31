**plaited** ( [Readme](../../README.md) \| API )

***

[Plaited Typedocs](../../../modules.md) / [plaited](../../modules.md) / [index](../README.md) / memo

# Function: memo()

> **memo**\<`T`\>(`resultFn`): [`FT`](../type-aliases/FT.md)\<`T`\>

Forked from  memoize-one
(c) Alexander Reardon - MIT
{@see https://github.com/alexreardon/memoize-one}
In this mode we constrain arguments to a single props object that extends TemplateProps
We also do a basic shallow comparison on the object to cache function result.

## Type parameters

▪ **T** extends `Record`\<`string`, `any`\> = `Record`\<`string`, `any`\>

## Parameters

▪ **resultFn**: [`FT`](../type-aliases/FT.md)\<`T`\>

## Returns

[`FT`](../type-aliases/FT.md)\<`T`\>

## Source

libs/jsx/dist/memo.d.ts:9

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)