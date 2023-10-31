**@plaited/rite** ( [Readme](../../../../README.md) \| API )

***

[Plaited Typedocs](../../../../../../modules.md) / [@plaited/rite](../../../../modules.md) / [index](../../../README.md) / [assert](../README.md) / fireEvent

# Variable: fireEvent

> **fireEvent**: \<`T`\>(`element`, `eventName`, `options`) => `Promise`\<`void`\>

Fires an event on the given element.

## Type parameters

▪ **T** extends `HTMLElement` \| `SVGElement` = `HTMLElement` \| `SVGElement`

## Parameters

▪ **element**: `T`

The element to fire the event on.

▪ **eventName**: `string`

The name of the event to fire.

▪ **options**: `EventArguments`= `undefined`

The options for the event.

## Returns

`Promise`\<`void`\>

A promise that resolves when the event has been fired.

## Source

[libs/rite/src/assert.ts:47](https://github.com/plaited/plaited/blob/0d4801d/libs/rite/src/assert.ts#L47)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
