**@plaited/component** ( [Readme](../README.md) \| API )

***

[Plaited Typedocs](../../../modules.md) / [@plaited/component](../modules.md) / Component

# Function: Component()

> **Component**\<`T`\>(`args`): [`PlaitedComponentConstructor`](../interfaces/PlaitedComponentConstructor.md)\<`T`\>

Creates a PlaitedComponent

## Type parameters

▪ **T** extends [`AdditionalAttrs`](../../jsx/index/interfaces/AdditionalAttrs.md) & `object` = [`AdditionalAttrs`](../../jsx/index/interfaces/AdditionalAttrs.md) & `object`

## Parameters

▪ **args**: `object`

Arguments for the PlaitedComponent

▪ **args.connect?**: [`Connect`](../interfaces/Connect.md)

Messenger connect callback from useMessenger

▪ **args.delegatesFocus?**: `boolean`

configure whether to delegate focus or not

**Default Value**

```ts
'true'
```

▪ **args.dev?**: `true` \| [`DevCallback`](../../behavioral/interfaces/DevCallback.md)

logger function to receive messages from behavioral program react streams

▪ **args.mode?**: `"closed"` \| `"open"`

define wether island's custom element is open or closed.

**Default Value**

```ts
'open'
```

▪ **args.observedTriggers?**: `Record`\<`string`, `string`\>

the element tag you want to use

▪ **args.strategy?**: [`Strategy`](../../behavioral/type-aliases/Strategy.md)

event selection strategy callback from behavioral library

▪ **args.tag**: \`${string}-${string}\`

PlaitedComponent tag name

▪ **args.template**: [`Template`](../../jsx/index/type-aliases/Template.md)

Optional Plaited Component shadow dom template

## Returns

[`PlaitedComponentConstructor`](../interfaces/PlaitedComponentConstructor.md)\<`T`\>

A PlaitedComponent

## Source

[libs/component/src/types.ts:70](https://github.com/plaited/plaited/blob/b151218/libs/component/src/types.ts#L70)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
