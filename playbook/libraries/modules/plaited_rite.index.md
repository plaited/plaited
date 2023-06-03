[Plaited Typedocs](../README.md) / [Modules](../modules.md) / [@plaited/rite](plaited_rite.md) / index

# Module: index

## Table of contents

### Namespaces

- [assert](plaited_rite.index.assert.md)
- [test](plaited_rite.index.test.md)

### Classes

- [AssertionError](../classes/plaited_rite.index.AssertionError.md)

### Interfaces

- [Assertion](../interfaces/plaited_rite.index.Assertion.md)

### Functions

- [assert](plaited_rite.index.md#assert)
- [t](plaited_rite.index.md#t)
- [test](plaited_rite.index.md#test)

## Functions

### assert

▸ **assert**<`T`\>(`param`): `void`

#### Type parameters

| Name |
| :------ |
| `T` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `param` | `Object` |
| `param.actual` | `T` |
| `param.expected` | `T` |
| `param.given` | `string` |
| `param.should` | `string` |

#### Returns

`void`

#### Defined in

[libs/rite/src/assert.ts:9](https://github.com/plaited/plaited/blob/4594bbc/libs/rite/src/assert.ts#L9)

___

### t

▸ **t**<`T`\>(`param`): `void`

#### Type parameters

| Name |
| :------ |
| `T` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `param` | `Object` |
| `param.actual` | `T` |
| `param.expected` | `T` |
| `param.given` | `string` |
| `param.should` | `string` |

#### Returns

`void`

#### Defined in

[libs/rite/src/assert.ts:9](https://github.com/plaited/plaited/blob/4594bbc/libs/rite/src/assert.ts#L9)

___

### test

▸ **test**(`name`, `cb`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `cb` | `TestCallback` |

#### Returns

`void`

#### Defined in

[libs/rite/src/test.ts:11](https://github.com/plaited/plaited/blob/4594bbc/libs/rite/src/test.ts#L11)
