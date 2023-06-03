[Plaited Typedocs](../README.md) / [Modules](../modules.md) / [@plaited/rite](../modules/plaited_rite.md) / [index](../modules/plaited_rite.index.md) / AssertionError

# Class: AssertionError

[@plaited/rite](../modules/plaited_rite.md).[index](../modules/plaited_rite.index.md).AssertionError

## Hierarchy

- `Error`

  ↳ **`AssertionError`**

## Table of contents

### Constructors

- [constructor](plaited_rite.index.AssertionError.md#constructor)

### Properties

- [cause](plaited_rite.index.AssertionError.md#cause)
- [message](plaited_rite.index.AssertionError.md#message)
- [name](plaited_rite.index.AssertionError.md#name)
- [stack](plaited_rite.index.AssertionError.md#stack)
- [prepareStackTrace](plaited_rite.index.AssertionError.md#preparestacktrace)
- [stackTraceLimit](plaited_rite.index.AssertionError.md#stacktracelimit)

### Methods

- [captureStackTrace](plaited_rite.index.AssertionError.md#capturestacktrace)

## Constructors

### constructor

• **new AssertionError**(`message`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `message` | `string` |

#### Overrides

Error.constructor

#### Defined in

[libs/rite/src/assert.ts:25](https://github.com/plaited/plaited/blob/20ae0c7/libs/rite/src/assert.ts#L25)

## Properties

### cause

• `Optional` **cause**: `unknown`

#### Inherited from

Error.cause

#### Defined in

node_modules/typescript/lib/lib.es2022.error.d.ts:24

___

### message

• **message**: `string`

#### Inherited from

Error.message

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1055

___

### name

• **name**: `string` = `'AssertionError'`

#### Overrides

Error.name

#### Defined in

[libs/rite/src/assert.ts:24](https://github.com/plaited/plaited/blob/20ae0c7/libs/rite/src/assert.ts#L24)

___

### stack

• `Optional` **stack**: `string`

#### Inherited from

Error.stack

#### Defined in

node_modules/typescript/lib/lib.es5.d.ts:1056

___

### prepareStackTrace

▪ `Static` `Optional` **prepareStackTrace**: (`err`: `Error`, `stackTraces`: `CallSite`[]) => `any`

#### Type declaration

▸ (`err`, `stackTraces`): `any`

Optional override for formatting stack traces

**`See`**

https://v8.dev/docs/stack-trace-api#customizing-stack-traces

##### Parameters

| Name | Type |
| :------ | :------ |
| `err` | `Error` |
| `stackTraces` | `CallSite`[] |

##### Returns

`any`

#### Inherited from

Error.prepareStackTrace

#### Defined in

node_modules/@types/node/globals.d.ts:11

___

### stackTraceLimit

▪ `Static` **stackTraceLimit**: `number`

#### Inherited from

Error.stackTraceLimit

#### Defined in

node_modules/@types/node/globals.d.ts:13

## Methods

### captureStackTrace

▸ `Static` **captureStackTrace**(`targetObject`, `constructorOpt?`): `void`

Create .stack property on a target object

#### Parameters

| Name | Type |
| :------ | :------ |
| `targetObject` | `object` |
| `constructorOpt?` | `Function` |

#### Returns

`void`

#### Inherited from

Error.captureStackTrace

#### Defined in

node_modules/@types/node/globals.d.ts:4
