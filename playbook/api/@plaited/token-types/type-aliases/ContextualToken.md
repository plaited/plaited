**@plaited/token-types** ( [Readme](../README.md) \| API )

***

[Plaited Typedocs](../../../modules.md) / [@plaited/token-types](../modules.md) / ContextualToken

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

[index.ts:338](https://github.com/plaited/plaited/blob/b0dd907/libs/token-types/src/index.ts#L338)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
