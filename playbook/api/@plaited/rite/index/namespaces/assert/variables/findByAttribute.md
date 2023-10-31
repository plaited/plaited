**@plaited/rite** ( [Readme](../../../../README.md) \| API )

***

[Plaited Typedocs](../../../../../../modules.md) / [@plaited/rite](../../../../modules.md) / [index](../../../README.md) / [assert](../README.md) / findByAttribute

# Variable: findByAttribute

> **findByAttribute**: \<`T`\>(`attributeName`, `attributeValue`, `context`?) => `Promise`\<`T`\>

Finds the first element that matches the given attribute name and value within the given context.
Searches within shadow DOM if present.

## Type parameters

▪ **T** extends `HTMLElement` \| `SVGElement` = `HTMLElement` \| `SVGElement`

## Parameters

▪ **attributeName**: `string`

The name of the attribute to search for.

▪ **attributeValue**: `string` \| `RegExp`

The value of the attribute to search for. Can be a string or a regular expression.

▪ **context?**: `HTMLElement` \| `SVGElement`

The context within which to search for the element. Defaults to the entire document.

## Returns

`Promise`\<`T`\>

A promise that resolves to the first element that matches the given attribute name and value, or undefined if no such element is found.

## Source

[libs/rite/src/assert.ts:45](https://github.com/plaited/plaited/blob/b0dd907/libs/rite/src/assert.ts#L45)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
