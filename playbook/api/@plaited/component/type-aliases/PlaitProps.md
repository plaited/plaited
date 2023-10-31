**@plaited/component** ( [Readme](../README.md) \| API )

***

[Plaited Typedocs](../../../modules.md) / [@plaited/component](../modules.md) / PlaitProps

# Type alias: PlaitProps

> **PlaitProps**: `object` & `ReturnType`\<*typeof* [`bProgram`](../../behavioral/functions/bProgram.md)\>

## Type declaration

### $

> **$**: [`$`](../interfaces/$.md)

query for elements with the data-target attribute in the Island's shadowDom and slots

### host

> **host**: [`PlaitedElement`](../interfaces/PlaitedElement.md)

The DOM node context allowing easy light & shadow dom access

#### Example

```ts
// returns the div element inside
// the shadowRoot of the element instance
const shadowEl = host.shadowRoot.querySelector('div')
```

## Source

[libs/component/src/types.ts:49](https://github.com/plaited/plaited/blob/b0dd907/libs/component/src/types.ts#L49)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
