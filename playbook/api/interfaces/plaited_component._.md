[Plaited Typedocs](../README.md) / [Exports](../modules.md) / [@plaited/component](../modules/plaited_component.md) / $

# Interface: $

[@plaited/component](../modules/plaited_component.md).$

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
| `opts.mod?` | [`SelectorMod`](../modules/plaited_component.md#selectormod) |

#### Returns

`SugaredElement`<`T`\>

#### Defined in

[libs/component/src/types.ts:25](https://github.com/plaited/plaited/blob/39779d0/libs/component/src/types.ts#L25)

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
| `opts.mod?` | [`SelectorMod`](../modules/plaited_component.md#selectormod) | - |

#### Returns

`SugaredElement`<`T`\>[]

#### Defined in

[libs/component/src/types.ts:32](https://github.com/plaited/plaited/blob/39779d0/libs/component/src/types.ts#L32)
