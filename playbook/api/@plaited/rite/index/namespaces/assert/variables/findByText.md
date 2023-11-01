**@plaited/rite** ( [Readme](../../../../README.md) \| API )

***

[Plaited Typedocs](../../../../../../modules.md) / [@plaited/rite](../../../../modules.md) / [index](../../../README.md) / [assert](../README.md) / findByText

# Variable: findByText

> **findByText**: \<`T`\>(`searchText`, `context`?) => `Promise`\<`T`\>

Finds an HTML element that contains the specified text content.

## Type parameters

▪ **T** extends `HTMLElement` = `HTMLElement`

## Parameters

▪ **searchText**: `string` \| `RegExp`

The text or regular expression to search for.

▪ **context?**: `HTMLElement`

The HTML element to search within. If not provided, the entire document body will be searched.

## Returns

`Promise`\<`T`\>

A promise that resolves with the first matching HTML element, or undefined if no match is found.

## Source

[libs/rite/src/assert.ts:46](https://github.com/plaited/plaited/blob/317e868/libs/rite/src/assert.ts#L46)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
