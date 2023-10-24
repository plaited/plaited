[Plaited Typedocs](../README.md) / [Exports](../modules.md) / [plaited](plaited.md) / index

# Module: index

## Table of contents

### Interfaces

- [AdditionalAttrs](../interfaces/plaited.index.AdditionalAttrs.md)
- [CreateTemplate](../interfaces/plaited.index.CreateTemplate.md)
- [DevCallback](../interfaces/plaited.index.DevCallback.md)
- [ISLElement](../interfaces/plaited.index.ISLElement.md)
- [ISLElementConstructor](../interfaces/plaited.index.ISLElementConstructor.md)
- [StateSnapshot](../interfaces/plaited.index.StateSnapshot.md)

### Type Aliases

- [Attrs](plaited.index.md#attrs)
- [BaseAttrs](plaited.index.md#baseattrs)
- [BroadcastMessage](plaited.index.md#broadcastmessage)
- [CandidateBid](plaited.index.md#candidatebid)
- [Child](plaited.index.md#child)
- [Children](plaited.index.md#children)
- [Detail](plaited.index.md#detail)
- [Disconnect](plaited.index.md#disconnect)
- [Feedback](plaited.index.md#feedback)
- [ISLElementOptions](plaited.index.md#islelementoptions)
- [ParameterIdiom](plaited.index.md#parameteridiom)
- [PendingBid](plaited.index.md#pendingbid)
- [Plait](plaited.index.md#plait)
- [PlaitProps](plaited.index.md#plaitprops)
- [PlaitedElement](plaited.index.md#plaitedelement)
- [Position](plaited.index.md#position)
- [Primitive](plaited.index.md#primitive)
- [RequestIdiom](plaited.index.md#requestidiom)
- [RuleSet](plaited.index.md#ruleset)
- [RulesFunc](plaited.index.md#rulesfunc)
- [RunningBid](plaited.index.md#runningbid)
- [SelectedMessage](plaited.index.md#selectedmessage)
- [SendMessage](plaited.index.md#sendmessage)
- [SnapshotMessage](plaited.index.md#snapshotmessage)
- [Strategy](plaited.index.md#strategy)
- [SugaredElement](plaited.index.md#sugaredelement)
- [Template](plaited.index.md#template)
- [Trigger](plaited.index.md#trigger)
- [TriggerArgs](plaited.index.md#triggerargs)

### Variables

- [dataTarget](plaited.index.md#datatarget)
- [dataTrigger](plaited.index.md#datatrigger)
- [sugar](plaited.index.md#sugar)
- [sugarForEach](plaited.index.md#sugarforeach)

### Functions

- [Fragment](plaited.index.md#fragment)
- [bProgram](plaited.index.md#bprogram)
- [classNames](plaited.index.md#classnames)
- [createTemplate](plaited.index.md#createtemplate)
- [css](plaited.index.md#css)
- [isle](plaited.index.md#isle)
- [loop](plaited.index.md#loop)
- [memo](plaited.index.md#memo)
- [ssr](plaited.index.md#ssr)
- [stylesheets](plaited.index.md#stylesheets)
- [sync](plaited.index.md#sync)
- [thread](plaited.index.md#thread)
- [useIndexedDB](plaited.index.md#useindexeddb)
- [useMain](plaited.index.md#usemain)
- [useMessenger](plaited.index.md#usemessenger)
- [useStore](plaited.index.md#usestore)
- [useSugar](plaited.index.md#usesugar)

## Type Aliases

### Attrs

Ƭ **Attrs**<`T`\>: [`BaseAttrs`](plaited.index.md#baseattrs) & `T`

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`AdditionalAttrs`](../interfaces/plaited.index.AdditionalAttrs.md) = [`AdditionalAttrs`](../interfaces/plaited.index.AdditionalAttrs.md) |

#### Defined in

libs/jsx/dist/types.d.ts:28

___

### BaseAttrs

Ƭ **BaseAttrs**: `Object`

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `children?` | [`Children`](plaited.index.md#children) | - |
| `class?` | `never` | - |
| `className?` | `string` | - |
| `data-target?` | `string` | - |
| `data-trigger?` | `Record`<`string`, `string`\> | - |
| `for?` | `never` | - |
| `htmlFor?` | `string` | - |
| `key?` | `string` | - |
| `shadowrootdelegatesfocus?` | `boolean` | - |
| `shadowrootmode?` | ``"open"`` \| ``"closed"`` | - |
| `slots?` | [`Children`](plaited.index.md#children) | - |
| `style?` | `Record`<`string`, `string`\> | - |
| `stylesheet?` | `string` \| `string`[] | - |
| `trusted?` | `boolean` | setting trusted to true will disable all escaping security policy measures for this element template |

#### Defined in

libs/jsx/dist/types.d.ts:11

___

### BroadcastMessage

Ƭ **BroadcastMessage**: (`recipient`: [`TriggerArgs`](plaited.index.md#triggerargs)) => `void`

#### Type declaration

▸ (`recipient`): `void`

##### Parameters

| Name | Type |
| :------ | :------ |
| `recipient` | [`TriggerArgs`](plaited.index.md#triggerargs) |

##### Returns

`void`

#### Defined in

[libs/plaited/src/types.ts:75](https://github.com/plaited/plaited/blob/3238787/libs/plaited/src/types.ts#L75)

___

### CandidateBid

Ƭ **CandidateBid**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `cb?` | `Callback` |
| `detail?` | [`Detail`](plaited.index.md#detail) |
| `priority` | `number` |
| `type` | `string` |

#### Defined in

libs/behavioral/dist/types.d.ts:52

___

### Child

Ƭ **Child**: `string` \| [`Template`](plaited.index.md#template)

#### Defined in

libs/jsx/dist/types.d.ts:6

___

### Children

Ƭ **Children**: [`Child`](plaited.index.md#child)[] \| [`Child`](plaited.index.md#child)

#### Defined in

libs/jsx/dist/types.d.ts:7

___

### Detail

Ƭ **Detail**: `unknown` \| () => `unknown` \| `Event`

#### Defined in

libs/behavioral/dist/types.d.ts:13

___

### Disconnect

Ƭ **Disconnect**: () => `void`

#### Type declaration

▸ (): `void`

##### Returns

`void`

#### Defined in

[libs/plaited/src/types.ts:13](https://github.com/plaited/plaited/blob/3238787/libs/plaited/src/types.ts#L13)

___

### Feedback

Ƭ **Feedback**: <T\>(`actions`: `Actions`<`T`\>) => `void`

#### Type declaration

▸ <`T`\>(`actions`): `void`

##### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `Record`<`string`, (`detail`: `any`) => `void`\> |

##### Parameters

| Name | Type |
| :------ | :------ |
| `actions` | `Actions`<`T`\> |

##### Returns

`void`

#### Defined in

libs/behavioral/dist/types.d.ts:62

___

### ISLElementOptions

Ƭ **ISLElementOptions**: `Object`

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `connect?` | (`recipient`: `string`, `trigger`: [`Trigger`](plaited.index.md#trigger)) => () => `void` | messenger connect callback |
| `delegatesFocus?` | `boolean` | configure whether to delegate focus or not **`Default Value`** ```ts 'true' ``` |
| `dev?` | [`DevCallback`](../interfaces/plaited.index.DevCallback.md) | logger function to receive messages from behavioral program react streams |
| `id?` | `boolean` | set to true if we wish to use id when connecting to messenger to receive messages from other islands |
| `mode?` | ``"open"`` \| ``"closed"`` | define wether island's custom element is open or closed. **`Default Value`** ```ts 'open' ``` |
| `strategy?` | [`Strategy`](plaited.index.md#strategy) | event selection strategy callback from behavioral library |
| `tag` | \`${string}-${string}\` | the element tag you want to use |

#### Defined in

[libs/plaited/src/types.ts:15](https://github.com/plaited/plaited/blob/3238787/libs/plaited/src/types.ts#L15)

___

### ParameterIdiom

Ƭ **ParameterIdiom**<`T`\>: { `cb?`: `Callback`<`T`\> ; `type`: `string`  } \| { `cb`: `Callback`<`T`\> ; `type?`: `string`  }

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`Detail`](plaited.index.md#detail) = [`Detail`](plaited.index.md#detail) |

#### Defined in

libs/behavioral/dist/types.d.ts:28

___

### PendingBid

Ƭ **PendingBid**: [`RuleSet`](plaited.index.md#ruleset) & [`RunningBid`](plaited.index.md#runningbid)

#### Defined in

libs/behavioral/dist/types.d.ts:51

___

### Plait

Ƭ **Plait**: (`props`: [`PlaitProps`](plaited.index.md#plaitprops)) => `void` \| `Promise`<`void`\>

#### Type declaration

▸ (`props`): `void` \| `Promise`<`void`\>

##### Parameters

| Name | Type |
| :------ | :------ |
| `props` | [`PlaitProps`](plaited.index.md#plaitprops) |

##### Returns

`void` \| `Promise`<`void`\>

#### Defined in

[libs/plaited/src/types.ts:11](https://github.com/plaited/plaited/blob/3238787/libs/plaited/src/types.ts#L11)

___

### PlaitProps

Ƭ **PlaitProps**: { `host`: [`ISLElement`](../interfaces/plaited.index.ISLElement.md) ; `$`: <T\>(`target`: `string`) => [`SugaredElement`](plaited.index.md#sugaredelement)<`T`\><T\>(`target`: `string`, `opts?`: { `all`: `boolean` ; `mod`: ``"="`` \| ``"~="`` \| ``"|="`` \| ``"^="`` \| ``"$="`` \| ``"*="``  }) => [`SugaredElement`](plaited.index.md#sugaredelement)<`T`\>[]  } & `ReturnType`<typeof [`bProgram`](plaited.index.md#bprogram)\>

#### Defined in

[libs/plaited/src/types.ts:50](https://github.com/plaited/plaited/blob/3238787/libs/plaited/src/types.ts#L50)

___

### PlaitedElement

Ƭ **PlaitedElement**<`T`\>: (`attrs`: `T` & [`BaseAttrs`](plaited.index.md#baseattrs)) => [`Template`](plaited.index.md#template)

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `Record`<`string`, `any`\> = `Record`<`string`, `any`\> |

#### Type declaration

▸ (`attrs`): [`Template`](plaited.index.md#template)

##### Parameters

| Name | Type |
| :------ | :------ |
| `attrs` | `T` & [`BaseAttrs`](plaited.index.md#baseattrs) |

##### Returns

[`Template`](plaited.index.md#template)

#### Defined in

libs/jsx/dist/types.d.ts:29

___

### Position

Ƭ **Position**: ``"beforebegin"`` \| ``"afterbegin"`` \| ``"beforeend"`` \| ``"afterend"``

#### Defined in

[libs/plaited/src/types.ts:78](https://github.com/plaited/plaited/blob/3238787/libs/plaited/src/types.ts#L78)

___

### Primitive

Ƭ **Primitive**: ``null`` \| `undefined` \| `number` \| `string` \| `boolean` \| `bigint`

#### Defined in

libs/jsx/dist/types.d.ts:1

___

### RequestIdiom

Ƭ **RequestIdiom**<`T`\>: `Object`

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`Detail`](plaited.index.md#detail) = [`Detail`](plaited.index.md#detail) |

#### Type declaration

| Name | Type |
| :------ | :------ |
| `detail?` | `T` |
| `type` | `string` |

#### Defined in

libs/behavioral/dist/types.d.ts:35

___

### RuleSet

Ƭ **RuleSet**<`T`\>: `Object`

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`Detail`](plaited.index.md#detail) = [`Detail`](plaited.index.md#detail) |

#### Type declaration

| Name | Type |
| :------ | :------ |
| `block?` | [`ParameterIdiom`](plaited.index.md#parameteridiom)<`T`\> \| [`ParameterIdiom`](plaited.index.md#parameteridiom)<`T`\>[] |
| `request?` | [`RequestIdiom`](plaited.index.md#requestidiom)<`T`\> \| [`RequestIdiom`](plaited.index.md#requestidiom)<`T`\>[] |
| `waitFor?` | [`ParameterIdiom`](plaited.index.md#parameteridiom)<`T`\> \| [`ParameterIdiom`](plaited.index.md#parameteridiom)<`T`\>[] |

#### Defined in

libs/behavioral/dist/types.d.ts:39

___

### RulesFunc

Ƭ **RulesFunc**<`T`\>: () => `IterableIterator`<[`RuleSet`](plaited.index.md#ruleset)<`T`\>\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`Detail`](plaited.index.md#detail) = [`Detail`](plaited.index.md#detail) |

#### Type declaration

▸ (): `IterableIterator`<[`RuleSet`](plaited.index.md#ruleset)<`T`\>\>

##### Returns

`IterableIterator`<[`RuleSet`](plaited.index.md#ruleset)<`T`\>\>

#### Defined in

libs/behavioral/dist/types.d.ts:44

___

### RunningBid

Ƭ **RunningBid**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `generator` | `IterableIterator`<[`RuleSet`](plaited.index.md#ruleset)\> |
| `priority` | `number` |
| `thread` | `string` |
| `trigger?` | ``true`` |

#### Defined in

libs/behavioral/dist/types.d.ts:45

___

### SelectedMessage

Ƭ **SelectedMessage**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `detail?` | [`Detail`](plaited.index.md#detail) |
| `type` | `string` |

#### Defined in

libs/behavioral/dist/types.d.ts:15

___

### SendMessage

Ƭ **SendMessage**: (`recipient`: `string`, `detail`: [`TriggerArgs`](plaited.index.md#triggerargs)) => `void`

#### Type declaration

▸ (`recipient`, `detail`): `void`

##### Parameters

| Name | Type |
| :------ | :------ |
| `recipient` | `string` |
| `detail` | [`TriggerArgs`](plaited.index.md#triggerargs) |

##### Returns

`void`

#### Defined in

[libs/plaited/src/types.ts:74](https://github.com/plaited/plaited/blob/3238787/libs/plaited/src/types.ts#L74)

___

### SnapshotMessage

Ƭ **SnapshotMessage**: `ReturnType`<[`StateSnapshot`](../interfaces/plaited.index.StateSnapshot.md)\>

#### Defined in

libs/behavioral/dist/types.d.ts:14

___

### Strategy

Ƭ **Strategy**: (`filteredEvents`: [`CandidateBid`](plaited.index.md#candidatebid)[] \| `never`[]) => [`CandidateBid`](plaited.index.md#candidatebid) \| `undefined`

#### Type declaration

▸ (`filteredEvents`): [`CandidateBid`](plaited.index.md#candidatebid) \| `undefined`

##### Parameters

| Name | Type |
| :------ | :------ |
| `filteredEvents` | [`CandidateBid`](plaited.index.md#candidatebid)[] \| `never`[] |

##### Returns

[`CandidateBid`](plaited.index.md#candidatebid) \| `undefined`

#### Defined in

libs/behavioral/dist/types.d.ts:58

___

### SugaredElement

Ƭ **SugaredElement**<`T`\>: `T` & typeof [`sugar`](plaited.index.md#sugar)

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `HTMLElement` \| `SVGElement` = `HTMLElement` \| `SVGElement` |

#### Defined in

[libs/plaited/src/use-sugar.ts:76](https://github.com/plaited/plaited/blob/3238787/libs/plaited/src/use-sugar.ts#L76)

___

### Template

Ƭ **Template**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `content` | `string` |
| `stylesheets` | `Set`<`string`\> |

#### Defined in

libs/jsx/dist/types.d.ts:2

___

### Trigger

Ƭ **Trigger**: <T\>(`args`: [`TriggerArgs`](plaited.index.md#triggerargs)<`T`\>) => `void`

#### Type declaration

▸ <`T`\>(`args`): `void`

##### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`Detail`](plaited.index.md#detail) = [`Detail`](plaited.index.md#detail) |

##### Parameters

| Name | Type |
| :------ | :------ |
| `args` | [`TriggerArgs`](plaited.index.md#triggerargs)<`T`\> |

##### Returns

`void`

#### Defined in

libs/behavioral/dist/types.d.ts:19

___

### TriggerArgs

Ƭ **TriggerArgs**<`T`\>: `Object`

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`Detail`](plaited.index.md#detail) = [`Detail`](plaited.index.md#detail) |

#### Type declaration

| Name | Type |
| :------ | :------ |
| `detail?` | `T` |
| `type` | `string` |

#### Defined in

libs/behavioral/dist/types.d.ts:20

## Variables

### dataTarget

• `Const` **dataTarget**: ``"data-target"``

attribute used to manipulate a dom element

#### Defined in

libs/jsx/dist/constants.d.ts:2

___

### dataTrigger

• `Const` **dataTrigger**: ``"data-trigger"``

attribute used to wire a dom element to the islands event listener

#### Defined in

libs/jsx/dist/constants.d.ts:4

___

### sugar

• `Const` **sugar**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `attr` | (`attr`: `string`, `val?`: `string`) => `string` \| `HTMLElement` \| `SVGElement` |
| `render` | (`tpl`: [`Template`](plaited.index.md#template), `position?`: [`Position`](plaited.index.md#position)) => `HTMLElement` \| `SVGElement` |
| `replace` | (`tpl`: [`Template`](plaited.index.md#template)) => `void` |

#### Defined in

[libs/plaited/src/use-sugar.ts:44](https://github.com/plaited/plaited/blob/3238787/libs/plaited/src/use-sugar.ts#L44)

___

### sugarForEach

• `Const` **sugarForEach**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `attr` | (`attrs`: `string` \| `Record`<`string`, `string`\>, `val?`: `string`) => [`SugaredElement`](plaited.index.md#sugaredelement)<`HTMLElement` \| `SVGElement`\>[] |
| `render` | (`template`: [`Template`](plaited.index.md#template)[], `position?`: [`Position`](plaited.index.md#position)) => [`SugaredElement`](plaited.index.md#sugaredelement)<`HTMLElement` \| `SVGElement`\>[] |
| `replace` | (`template`: [`Template`](plaited.index.md#template)[]) => [`SugaredElement`](plaited.index.md#sugaredelement)<`HTMLElement` \| `SVGElement`\>[] |

#### Defined in

[libs/plaited/src/use-sugar.ts:80](https://github.com/plaited/plaited/blob/3238787/libs/plaited/src/use-sugar.ts#L80)

## Functions

### Fragment

▸ **Fragment**(`«destructured»`): `Object`

#### Parameters

| Name | Type |
| :------ | :------ |
| `«destructured»` | [`Attrs`](plaited.index.md#attrs) |

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `content` | `string` |
| `stylesheets` | `Set`<`string`\> |

#### Defined in

libs/jsx/dist/create-template.d.ts:5

___

### bProgram

▸ **bProgram**(`«destructured»?`): `Readonly`<{ `addThreads`: (`threads`: `Record`<`string`, [`RulesFunc`](plaited.index.md#rulesfunc)\>) => `void` ; `feedback`: [`Feedback`](plaited.index.md#feedback) ; `loop`: (`rules`: [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\>[], `condition?`: () => `boolean`) => [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\> ; `sync`: <T\>(`set`: [`RuleSet`](plaited.index.md#ruleset)<`T`\>) => [`RulesFunc`](plaited.index.md#rulesfunc)<`T`\> ; `thread`: (...`rules`: [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\>[]) => [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\> ; `trigger`: [`Trigger`](plaited.index.md#trigger)  }\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `«destructured»` | `Object` |
| › `dev?` | [`DevCallback`](../interfaces/plaited.index.DevCallback.md) |
| › `strategy?` | ``"priority"`` \| ``"randomized"`` \| ``"chaos"`` \| [`Strategy`](plaited.index.md#strategy) |

#### Returns

`Readonly`<{ `addThreads`: (`threads`: `Record`<`string`, [`RulesFunc`](plaited.index.md#rulesfunc)\>) => `void` ; `feedback`: [`Feedback`](plaited.index.md#feedback) ; `loop`: (`rules`: [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\>[], `condition?`: () => `boolean`) => [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\> ; `sync`: <T\>(`set`: [`RuleSet`](plaited.index.md#ruleset)<`T`\>) => [`RulesFunc`](plaited.index.md#rulesfunc)<`T`\> ; `thread`: (...`rules`: [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\>[]) => [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\> ; `trigger`: [`Trigger`](plaited.index.md#trigger)  }\>

#### Defined in

libs/behavioral/dist/b-program.d.ts:3

___

### classNames

▸ **classNames**(`...classes`): `string`

takes an array of conditional css class name strings and returns them concatenated

#### Parameters

| Name | Type |
| :------ | :------ |
| `...classes` | `ClassNameProps` |

#### Returns

`string`

#### Defined in

[libs/plaited/src/class-names.ts:3](https://github.com/plaited/plaited/blob/3238787/libs/plaited/src/class-names.ts#L3)

___

### createTemplate

▸ **createTemplate**<`T`\>(`tag`, `attrs`): [`Template`](plaited.index.md#template)

createTemplate function used for ssr

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`AdditionalAttrs`](../interfaces/plaited.index.AdditionalAttrs.md) |

#### Parameters

| Name | Type |
| :------ | :------ |
| `tag` | `Tag` |
| `attrs` | [`Attrs`](plaited.index.md#attrs)<`T`\> |

#### Returns

[`Template`](plaited.index.md#template)

#### Defined in

libs/jsx/dist/types.d.ts:32

___

### css

▸ **css**(`strings`, `...expressions`): readonly [`Record`<`string`, `string`\>, { `stylesheet`: `string`  }]

tagged template function for creating css module style styles and classNames objects

#### Parameters

| Name | Type |
| :------ | :------ |
| `strings` | `TemplateStringsArray` |
| `...expressions` | ([`Primitive`](plaited.index.md#primitive) \| [`Primitive`](plaited.index.md#primitive)[])[] |

#### Returns

readonly [`Record`<`string`, `string`\>, { `stylesheet`: `string`  }]

#### Defined in

libs/jsx/dist/css.d.ts:4

___

### isle

▸ **isle**(`«destructured»`, `mixin?`): () => `void`

A typescript function for instantiating Plaited Island Elements

#### Parameters

| Name | Type |
| :------ | :------ |
| `«destructured»` | [`ISLElementOptions`](plaited.index.md#islelementoptions) |
| `mixin` | (`base`: [`ISLElementConstructor`](../interfaces/plaited.index.ISLElementConstructor.md)) => [`ISLElementConstructor`](../interfaces/plaited.index.ISLElementConstructor.md) |

#### Returns

`fn`

▸ (): `void`

##### Returns

`void`

| Name | Type |
| :------ | :------ |
| `tag` | `string` |

#### Defined in

[libs/plaited/src/isle.ts:21](https://github.com/plaited/plaited/blob/3238787/libs/plaited/src/isle.ts#L21)

___

### loop

▸ **loop**(`rules`, `condition?`): [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `rules` | [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\>[] |
| `condition?` | () => `boolean` |

#### Returns

[`RulesFunc`](plaited.index.md#rulesfunc)<`any`\>

**`Description`**

A behavioral thread that loops infinitely or until some callback condition is false
like a mode change open -> close. This function returns a threads

#### Defined in

libs/behavioral/dist/rules.d.ts:12

___

### memo

▸ **memo**<`T`\>(`resultFn`): [`PlaitedElement`](plaited.index.md#plaitedelement)<`T`\>

Forked from  memoize-one
(c) Alexander Reardon - MIT
{@see https://github.com/alexreardon/memoize-one}
In this mode we constrain arguments to a single props object that extends TemplateProps
We also do a basic shallow comparison on the object to cache function result.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `Record`<`string`, `any`\> = `Record`<`string`, `any`\> |

#### Parameters

| Name | Type |
| :------ | :------ |
| `resultFn` | [`PlaitedElement`](plaited.index.md#plaitedelement)<`T`\> |

#### Returns

[`PlaitedElement`](plaited.index.md#plaitedelement)<`T`\>

#### Defined in

[libs/plaited/src/memo.ts:27](https://github.com/plaited/plaited/blob/3238787/libs/plaited/src/memo.ts#L27)

___

### ssr

▸ **ssr**(`...templates`): `string`

#### Parameters

| Name | Type |
| :------ | :------ |
| `...templates` | [`Template`](plaited.index.md#template)[] |

#### Returns

`string`

#### Defined in

libs/jsx/dist/ssr.d.ts:2

___

### stylesheets

▸ **stylesheets**(`...sheets`): `Object`

takes an array of conditional stylesheet objects and returns a stylesheet 
object with each individual sheet in an array

#### Parameters

| Name | Type |
| :------ | :------ |
| `...sheets` | `StylesheetsProps` |

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `stylesheet` | `any`[] |

#### Defined in

[libs/plaited/src/stylesheets.ts:4](https://github.com/plaited/plaited/blob/3238787/libs/plaited/src/stylesheets.ts#L4)

___

### sync

▸ **sync**<`T`\>(`set`): [`RulesFunc`](plaited.index.md#rulesfunc)<`T`\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `unknown` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `set` | [`RuleSet`](plaited.index.md#ruleset)<`T`\> |

#### Returns

[`RulesFunc`](plaited.index.md#rulesfunc)<`T`\>

**`Description`**

At synchronization points, each behavioral thread specifies three sets of events:
requested events: the threads proposes that these be considered for triggering,
and asks to be notified when any of them occurs; waitFor events: the threads does not request these, but
asks to be notified when any of them is triggered; and blocked events: the
threads currently forbids triggering
any of these events.

#### Defined in

libs/behavioral/dist/rules.d.ts:22

___

### thread

▸ **thread**(`...rules`): [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `...rules` | [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\>[] |

#### Returns

[`RulesFunc`](plaited.index.md#rulesfunc)<`any`\>

**`Description`**

creates a behavioral thread from synchronization sets and/or other  behavioral threads

#### Defined in

libs/behavioral/dist/rules.d.ts:6

___

### useIndexedDB

▸ **useIndexedDB**<`T`\>(`key`, `initialValue?`, `option?`): `Promise`<readonly [`Get`<`T`\>, `Set`<`T`\>]\>

asynchronously get and set indexed db values

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | `unknown` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `key` | `string` | key for stored value |
| `initialValue?` | `T` | initial value can be null |
| `option?` | `Object` | you can actually pass it an reference to another indexedDB |
| `option.databaseName` | `string` | - |
| `option.storeName` | `string` | - |

#### Returns

`Promise`<readonly [`Get`<`T`\>, `Set`<`T`\>]\>

#### Defined in

[libs/plaited/src/use-indexed-db.ts:13](https://github.com/plaited/plaited/blob/3238787/libs/plaited/src/use-indexed-db.ts#L13)

___

### useMain

▸ **useMain**(`context`, `trigger`): readonly [`Send`, [`Disconnect`](plaited.index.md#disconnect)]

is a hook to allow us to send and receive messages from the main thread in a worker

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `context` | `Window` & typeof `globalThis` | is self of the worker |
| `trigger` | [`Trigger`](plaited.index.md#trigger) | - |

#### Returns

readonly [`Send`, [`Disconnect`](plaited.index.md#disconnect)]

#### Defined in

[libs/plaited/src/use-main.ts:6](https://github.com/plaited/plaited/blob/3238787/libs/plaited/src/use-main.ts#L6)

___

### useMessenger

▸ **useMessenger**(): readonly [`Connect`, `Send`]

Enables communication between agents in a web app.
Agents can be Islands, workers, or behavioral program running in the main thread.
This allows for execution of the one-way message exchange pattern (aka
fire and forget).

#### Returns

readonly [`Connect`, `Send`]

readonly {}
  connect: (recipient: string, trigger: [Trigger](plaited.index.md#trigger)) => [Disconnect](plaited.index.md#disconnect),
  send: (recipient: string, detail: [TriggerArgs](plaited.index.md#triggerargs)) => void
  worker: (id: string, url: string) =>  [Disconnect](plaited.index.md#disconnect)
}

#### Defined in

[libs/plaited/src/use-messenger.ts:24](https://github.com/plaited/plaited/blob/3238787/libs/plaited/src/use-messenger.ts#L24)

___

### useStore

▸ **useStore**<`T`\>(`initialStore?`): readonly [`Get`<`T`\>, `Set`<`T`\>]

#### Type parameters

| Name |
| :------ |
| `T` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `initialStore?` | `T` |

#### Returns

readonly [`Get`<`T`\>, `Set`<`T`\>]

**`Description`**

a simple utility function for safely getting and setting values you need to persist during run.
When using the callback feature userStore passes a structured clone of the currently stored value
as a parameter.

**`Example`**

```ts
const [store, setStore] = useStore<Record<string, number> | number>({ a: 1 })
 setStore((prev) => {
   if (typeof prev !== 'number') prev.b = 2
   return prev
 })
 store() //=> { a: 1, b: 2 }
 setStore(3)
 store() // => 3
```

#### Defined in

[libs/plaited/src/use-store.ts:27](https://github.com/plaited/plaited/blob/3238787/libs/plaited/src/use-store.ts#L27)

___

### useSugar

▸ **useSugar**(`element`): [`SugaredElement`](plaited.index.md#sugaredelement)<`HTMLElement` \| `SVGElement`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `element` | `HTMLElement` \| `SVGElement` |

#### Returns

[`SugaredElement`](plaited.index.md#sugaredelement)<`HTMLElement` \| `SVGElement`\>

#### Defined in

[libs/plaited/src/use-sugar.ts:110](https://github.com/plaited/plaited/blob/3238787/libs/plaited/src/use-sugar.ts#L110)
