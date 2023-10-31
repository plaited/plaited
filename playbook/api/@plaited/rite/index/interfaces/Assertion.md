**@plaited/rite** ( [Readme](../../README.md) \| API )

***

[Plaited Typedocs](../../../../modules.md) / [@plaited/rite](../../modules.md) / [index](../README.md) / Assertion

# Interface: Assertion()

> **Assertion**\<`T`\>(`param`): `void`

## Contents

- [Type parameters](Assertion.md#type-parameters)
- [Parameters](Assertion.md#parameters)
- [Returns](Assertion.md#returns)
- [Source](Assertion.md#source)
- [Properties](Assertion.md#properties)
  - [findByAttribute](Assertion.md#findbyattribute)
  - [findByText](Assertion.md#findbytext)
  - [fireEvent](Assertion.md#fireevent)
  - [match](Assertion.md#match)
  - [throws](Assertion.md#throws)
  - [wait](Assertion.md#wait)

## Type parameters

▪ **T**

## Parameters

▪ **param**: `object`

▪ **param.actual**: `T`

▪ **param.expected**: `T`

▪ **param.given**: `string`

▪ **param.should**: `string`

## Returns

`void`

## Source

[libs/rite/src/assert.ts:9](https://github.com/plaited/plaited/blob/b0dd907/libs/rite/src/assert.ts#L9)

## Properties

### findByAttribute

> **findByAttribute**: \<`T`\>(`attributeName`, `attributeValue`, `context`?) => `Promise`\<`T`\>

Finds the first element that matches the given attribute name and value within the given context.
Searches within shadow DOM if present.

#### Type parameters

▪ **T** extends `HTMLElement` \| `SVGElement` = `HTMLElement` \| `SVGElement`

#### Parameters

▪ **attributeName**: `string`

The name of the attribute to search for.

▪ **attributeValue**: `string` \| `RegExp`

The value of the attribute to search for. Can be a string or a regular expression.

▪ **context?**: `HTMLElement` \| `SVGElement`

The context within which to search for the element. Defaults to the entire document.

#### Returns

`Promise`\<`T`\>

A promise that resolves to the first element that matches the given attribute name and value, or undefined if no such element is found.

#### Source

[libs/rite/src/assert.ts:10](https://github.com/plaited/plaited/blob/b0dd907/libs/rite/src/assert.ts#L10)

***

### findByText

> **findByText**: \<`T`\>(`searchText`, `context`?) => `Promise`\<`T`\>

Finds an HTML element that contains the specified text content.

#### Type parameters

▪ **T** extends `HTMLElement` = `HTMLElement`

#### Parameters

▪ **searchText**: `string` \| `RegExp`

The text or regular expression to search for.

▪ **context?**: `HTMLElement`

The HTML element to search within. If not provided, the entire document body will be searched.

#### Returns

`Promise`\<`T`\>

A promise that resolves with the first matching HTML element, or undefined if no match is found.

#### Source

[libs/rite/src/assert.ts:11](https://github.com/plaited/plaited/blob/b0dd907/libs/rite/src/assert.ts#L11)

***

### fireEvent

> **fireEvent**: \<`T`\>(`element`, `eventName`, `options`) => `Promise`\<`void`\>

Fires an event on the given element.

#### Type parameters

▪ **T** extends `HTMLElement` \| `SVGElement` = `HTMLElement` \| `SVGElement`

#### Parameters

▪ **element**: `T`

The element to fire the event on.

▪ **eventName**: `string`

The name of the event to fire.

▪ **options**: `EventArguments`= `undefined`

The options for the event.

#### Returns

`Promise`\<`void`\>

A promise that resolves when the event has been fired.

#### Source

[libs/rite/src/assert.ts:12](https://github.com/plaited/plaited/blob/b0dd907/libs/rite/src/assert.ts#L12)

***

### match

> **match**: (`str`) => (`pattern`) => `string`

#### Parameters

▪ **str**: `string`

#### Returns

`function`

> > (`pattern`): `string`
>
> ##### Parameters
>
> ▪ **pattern**: `string` \| `RegExp`
>
> ##### Returns
>
> `string`
>
> ##### Source
>
> [libs/rite/src/match.ts:3](https://github.com/plaited/plaited/blob/b0dd907/libs/rite/src/match.ts#L3)
>

#### Source

[libs/rite/src/assert.ts:13](https://github.com/plaited/plaited/blob/b0dd907/libs/rite/src/assert.ts#L13)

***

### throws

> **throws**: `Throws`

#### Source

[libs/rite/src/assert.ts:14](https://github.com/plaited/plaited/blob/b0dd907/libs/rite/src/assert.ts#L14)

***

### wait

> **wait**: (`ms`) => `Promise`\<`unknown`\>

an async function that will wait the given time passed to it in ms

#### Parameters

▪ **ms**: `number`

#### Returns

`Promise`\<`unknown`\>

#### Source

[libs/rite/src/assert.ts:15](https://github.com/plaited/plaited/blob/b0dd907/libs/rite/src/assert.ts#L15)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
