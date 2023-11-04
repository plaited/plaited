**plaited** ( [Readme](../../README.md) \| API )

***

[Plaited Typedocs](../../../modules.md) / [plaited](../../modules.md) / [index](../README.md) / ComponentFunction

# Type alias: ComponentFunction

> **ComponentFunction**: \<`T`\>(`args`) => [`PlaitedComponentConstructor`](../interfaces/PlaitedComponentConstructor.md)\<`T`\>

## Type parameters

▪ **T** extends [`AdditionalAttrs`](../interfaces/AdditionalAttrs.md) & `object` = [`AdditionalAttrs`](../interfaces/AdditionalAttrs.md) & `object`

## Parameters

▪ **args**: `object`

▪ **args.connect?**: [`Connect`](../interfaces/Connect.md)

Messenger connect callback from useMessenger

▪ **args.delegatesFocus?**: `boolean`

configure whether to delegate focus or not

**Default Value**

```ts
'true'
```

▪ **args.dev?**: `true` \| [`DevCallback`](../interfaces/DevCallback.md)

logger function to receive messages from behavioral program react streams

▪ **args.mode?**: `"open"` \| `"closed"`

define wether island's custom element is open or closed.

**Default Value**

```ts
'open'
```

▪ **args.observedTriggers?**: `Record`\<`string`, `string`\>

the element tag you want to use

▪ **args.strategy?**: [`Strategy`](Strategy.md)

event selection strategy callback from behavioral library

▪ **args.tag**: \`${string}-${string}\`

PlaitedComponent tag name

▪ **args.template**: [`Template`](Template.md)

Optional Plaited Component shadow dom template

## Returns

[`PlaitedComponentConstructor`](../interfaces/PlaitedComponentConstructor.md)\<`T`\>

## Source

libs/component/dist/types.d.ts:60

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
