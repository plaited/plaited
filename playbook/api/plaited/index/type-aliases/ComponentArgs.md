**plaited** ( [Readme](../../README.md) \| API )

***

[Plaited Typedocs](../../../modules.md) / [plaited](../../modules.md) / [index](../README.md) / ComponentArgs

# Type alias: ComponentArgs

> **ComponentArgs**: `object`

## Type declaration

### connect

> **connect**?: [`Connect`](../interfaces/Connect.md)

Messenger connect callback from useMessenger

### delegatesFocus

> **delegatesFocus**?: `boolean`

configure whether to delegate focus or not

#### Default Value

```ts
'true'
```

### dev

> **dev**?: `true` \| [`DevCallback`](../interfaces/DevCallback.md)

logger function to receive messages from behavioral program react streams

### mode

> **mode**?: `"open"` \| `"closed"`

define wether island's custom element is open or closed.

#### Default Value

```ts
'open'
```

### observedTriggers

> **observedTriggers**?: `Record`\<`string`, `string`\>

the element tag you want to use

### strategy

> **strategy**?: [`Strategy`](Strategy.md)

event selection strategy callback from behavioral library

### tag

> **tag**: \`${string}-${string}\`

PlaitedComponent tag name

### template

> **template**: [`Template`](Template.md)

Optional Plaited Component shadow dom template

## Source

libs/component/dist/types.d.ts:58

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
