[Plaited Typedocs](../README.md) / [Exports](../modules.md) / [plaited](../modules/plaited.md) / [index](../modules/plaited.index.md) / $

# Interface: $

[plaited](../modules/plaited.md).[index](../modules/plaited.index.md).$

## Callable

### $

▸ **$**<`T`\>(`target`, `opts?`): `SugaredElement`<`T`\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `HTMLElement` \| `SVGElement` = `HTMLElement` \| `SVGElement` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `target` | `string` |
| `opts?` | `Object` |
| `opts.all?` | ``false`` |
| `opts.mod?` | [`SelectorMod`](../modules/plaited.index.md#selectormod) |

#### Returns

`SugaredElement`<`T`\>

#### Defined in

libs/component/dist/types.d.ts:15

### $

▸ **$**<`T`\>(`target`, `opts?`): `SugaredElement`<`T`\>[]

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `HTMLElement` \| `SVGElement` = `HTMLElement` \| `SVGElement` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `target` | `string` | - |
| `opts?` | `Object` | This options enables querySelectorAll and modified the attribute selector for data-target{@default {all: false, mod: "=" }} [https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors#syntax](https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors#syntax) |
| `opts.all` | ``true`` | - |
| `opts.mod?` | [`SelectorMod`](../modules/plaited.index.md#selectormod) | - |

#### Returns

`SugaredElement`<`T`\>[]

#### Defined in

libs/component/dist/types.d.ts:19
