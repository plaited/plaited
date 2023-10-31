**@plaited/rite** ( [Readme](../../README.md) \| API )

***

[Plaited Typedocs](../../../../modules.md) / [@plaited/rite](../../modules.md) / [index](../README.md) / AssertionError

# Class: AssertionError

## Contents

- [Extends](AssertionError.md#extends)
- [Constructors](AssertionError.md#constructors)
  - [new AssertionError(message)](AssertionError.md#new-assertionerrormessage)
- [Properties](AssertionError.md#properties)
  - [cause](AssertionError.md#cause)
  - [message](AssertionError.md#message)
  - [name](AssertionError.md#name)
  - [stack](AssertionError.md#stack)
  - [prepareStackTrace](AssertionError.md#preparestacktrace)
  - [stackTraceLimit](AssertionError.md#stacktracelimit)
- [Methods](AssertionError.md#methods)
  - [captureStackTrace()](AssertionError.md#capturestacktrace)

## Extends

- `Error`

## Constructors

### new AssertionError(message)

> **new AssertionError**(`message`): [`AssertionError`](AssertionError.md)

#### Parameters

▪ **message**: `string`

#### Returns

[`AssertionError`](AssertionError.md)

#### Overrides

Error.constructor

#### Source

[libs/rite/src/assert.ts:20](https://github.com/plaited/plaited/blob/b0dd907/libs/rite/src/assert.ts#L20)

## Properties

### cause

> **cause**?: `unknown`

#### Inherited from

Error.cause

#### Source

node\_modules/typescript/lib/lib.es2022.error.d.ts:24

***

### message

> **message**: `string`

#### Inherited from

Error.message

#### Source

node\_modules/typescript/lib/lib.es5.d.ts:1068

***

### name

> **name**: `string` = `'AssertionError'`

#### Overrides

Error.name

#### Source

[libs/rite/src/assert.ts:19](https://github.com/plaited/plaited/blob/b0dd907/libs/rite/src/assert.ts#L19)

***

### stack

> **stack**?: `string`

#### Inherited from

Error.stack

#### Source

node\_modules/typescript/lib/lib.es5.d.ts:1069

***

### prepareStackTrace

> **`static`** **prepareStackTrace**?: (`err`, `stackTraces`) => `any`

Optional override for formatting stack traces

#### Parameters

▪ **err**: `Error`

▪ **stackTraces**: `CallSite`[]

#### Returns

`any`

#### See

https://v8.dev/docs/stack-trace-api#customizing-stack-traces

#### Inherited from

Error.prepareStackTrace

#### Source

node\_modules/@types/node/globals.d.ts:11

***

### stackTraceLimit

> **`static`** **stackTraceLimit**: `number`

#### Inherited from

Error.stackTraceLimit

#### Source

node\_modules/@types/node/globals.d.ts:13

## Methods

### captureStackTrace()

> **`static`** **captureStackTrace**(`targetObject`, `constructorOpt`?): `void`

Create .stack property on a target object

#### Parameters

▪ **targetObject**: `object`

▪ **constructorOpt?**: `Function`

#### Returns

`void`

#### Inherited from

Error.captureStackTrace

#### Source

node\_modules/@types/node/globals.d.ts:4

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
