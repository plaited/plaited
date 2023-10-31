**plaited** ( [Readme](../../README.md) \| API )

***

[Plaited Typedocs](../../../modules.md) / [plaited](../../modules.md) / [token](../README.md) / ContextualToken

# Type alias: ContextualToken`<T, V>`

> **ContextualToken**\<`T`, `V`\>: `object`

## Type parameters

| Parameter |
| :------ |
| `T` extends `string` |
| `V` extends [`DesignValue`](DesignValue.md) |

## Type declaration

### $description

> **$description**: `string`

### $extensions

> **$extensions**?: `object`

#### Index signature

 \[`key`: `string`\]: `unknown`

### $extensions.plaited-context

> **$extensions.plaited-context**: [`$Context`]($Context.md)

### $type

> **$type**: `T`

### $value

> **$value**: [`ContextValue`](ContextValue.md)\<`V`\>

## Source

libs/token-types/dist/index.d.ts:227

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
