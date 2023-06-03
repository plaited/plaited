[Plaited Typedocs](../README.md) / [Modules](../modules.md) / [plaited](plaited.md) / index

# Module: index

## Table of contents

### Interfaces

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
- [Children](plaited.index.md#children)
- [Detail](plaited.index.md#detail)
- [Disconnect](plaited.index.md#disconnect)
- [Feedback](plaited.index.md#feedback)
- [ISLElementOptions](plaited.index.md#islelementoptions)
- [ParameterIdiom](plaited.index.md#parameteridiom)
- [PendingBid](plaited.index.md#pendingbid)
- [PlaitProps](plaited.index.md#plaitprops)
- [PlaitedElement](plaited.index.md#plaitedelement)
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
- [canUseSlot](plaited.index.md#canuseslot)
- [classNames](plaited.index.md#classnames)
- [createTemplate](plaited.index.md#createtemplate)
- [css](plaited.index.md#css)
- [getTriggerKey](plaited.index.md#gettriggerkey)
- [isle](plaited.index.md#isle)
- [loop](plaited.index.md#loop)
- [matchAllEvents](plaited.index.md#matchallevents)
- [memo](plaited.index.md#memo)
- [ssr](plaited.index.md#ssr)
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
| `T` | extends `Record`<`string`, `any`\> = `Record`<`string`, `any`\> |

#### Defined in

libs/jsx/dist/types.d.ts:23

___

### BaseAttrs

Ƭ **BaseAttrs**: `Object`

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `class?` | `never` | - |
| `className?` | `string` | - |
| `data-target?` | `string` \| `number` | - |
| `data-trigger?` | `Record`<`string`, `string`\> | - |
| `for?` | `never` | - |
| `htmlFor?` | `string` | - |
| `key?` | `string` | - |
| `shadowrootdelegatesfocus?` | `boolean` | - |
| `shadowrootmode?` | ``"open"`` \| ``"closed"`` | - |
| `slots?` | [`Children`](plaited.index.md#children) | - |
| `style?` | `Record`<`string`, `string`\> | - |
| `stylesheet?` | `string` | - |
| `trusted?` | `boolean` | setting trusted to true will disable all escaping security policy measures for this element template |

#### Defined in

libs/jsx/dist/types.d.ts:7

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

[libs/plaited/src/types.ts:71](https://github.com/plaited/plaited/blob/c0c0cf6/libs/plaited/src/types.ts#L71)

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

### Children

Ƭ **Children**: (`string` \| [`Template`](plaited.index.md#template))[] \| `string` \| [`Template`](plaited.index.md#template)

#### Defined in

libs/jsx/dist/types.d.ts:6

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

[libs/plaited/src/types.ts:10](https://github.com/plaited/plaited/blob/c0c0cf6/libs/plaited/src/types.ts#L10)

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
| `delegatesFocus?` | `boolean` | configure whether to delegate focus or not **`Default Value`** 'true' |
| `dev?` | [`DevCallback`](../interfaces/plaited.index.DevCallback.md) | logger function to receive messages from behavioral program react streams |
| `id?` | `boolean` | set to true if we wish to use id when connecting to messenger to receive messages from other islands |
| `mode?` | ``"open"`` \| ``"closed"`` | define wether island's custom element is open or closed. **`Default Value`** 'open' |
| `strategy?` | [`Strategy`](plaited.index.md#strategy) | event selection strategy callback from behavioral library |
| `tag` | \`${string}-${string}\` | the element tag you want to use |

#### Defined in

[libs/plaited/src/types.ts:12](https://github.com/plaited/plaited/blob/c0c0cf6/libs/plaited/src/types.ts#L12)

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

### PlaitProps

Ƭ **PlaitProps**: { `context`: [`ISLElement`](../interfaces/plaited.index.ISLElement.md) ; `$`: <T\>(`target`: `string`) => [`SugaredElement`](plaited.index.md#sugaredelement)<`T`\><T\>(`target`: `string`, `opts?`: { `all`: `boolean` ; `mod`: ``"="`` \| ``"~="`` \| ``"|="`` \| ``"^="`` \| ``"$="`` \| ``"*="``  }) => [`SugaredElement`](plaited.index.md#sugaredelement)<`T`\>[]  } & `ReturnType`<typeof [`bProgram`](plaited.index.md#bprogram)\>

#### Defined in

[libs/plaited/src/types.ts:47](https://github.com/plaited/plaited/blob/c0c0cf6/libs/plaited/src/types.ts#L47)

___

### PlaitedElement

Ƭ **PlaitedElement**<`T`\>: (`attrs`: [`Attrs`](plaited.index.md#attrs)<`T`\>) => [`Template`](plaited.index.md#template)

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `Record`<`string`, `any`\> = `Record`<`string`, `any`\> |

#### Type declaration

▸ (`attrs`): [`Template`](plaited.index.md#template)

##### Parameters

| Name | Type |
| :------ | :------ |
| `attrs` | [`Attrs`](plaited.index.md#attrs)<`T`\> |

##### Returns

[`Template`](plaited.index.md#template)

#### Defined in

libs/jsx/dist/types.d.ts:24

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

[libs/plaited/src/types.ts:70](https://github.com/plaited/plaited/blob/c0c0cf6/libs/plaited/src/types.ts#L70)

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

[libs/plaited/src/use-sugar.ts:45](https://github.com/plaited/plaited/blob/c0c0cf6/libs/plaited/src/use-sugar.ts#L45)

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
| `render` | (`__namedParameters`: [`Template`](plaited.index.md#template), `position?`: `Position`) => `HTMLElement` \| `SVGElement` |
| `replace` | (`__namedParameters`: [`Template`](plaited.index.md#template)) => `void` |

#### Defined in

[libs/plaited/src/use-sugar.ts:9](https://github.com/plaited/plaited/blob/c0c0cf6/libs/plaited/src/use-sugar.ts#L9)

___

### sugarForEach

• `Const` **sugarForEach**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `attr` | (`attrs`: `string` \| `Record`<`string`, `string`\>, `val?`: `string`) => [`SugaredElement`](plaited.index.md#sugaredelement)<`HTMLElement` \| `SVGElement`\>[] |
| `render` | (`template`: [`Template`](plaited.index.md#template)[], `position?`: `Position`) => [`SugaredElement`](plaited.index.md#sugaredelement)<`HTMLElement` \| `SVGElement`\>[] |
| `replace` | (`template`: [`Template`](plaited.index.md#template)[]) => [`SugaredElement`](plaited.index.md#sugaredelement)<`HTMLElement` \| `SVGElement`\>[] |

#### Defined in

[libs/plaited/src/use-sugar.ts:49](https://github.com/plaited/plaited/blob/c0c0cf6/libs/plaited/src/use-sugar.ts#L49)

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

### canUseSlot

▸ **canUseSlot**(`node`): `boolean`

#### Parameters

| Name | Type |
| :------ | :------ |
| `node` | `HTMLSlotElement` |

#### Returns

`boolean`

#### Defined in

[libs/plaited/src/isle.ts:46](https://github.com/plaited/plaited/blob/c0c0cf6/libs/plaited/src/isle.ts#L46)

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

[libs/plaited/src/class-names.ts:3](https://github.com/plaited/plaited/blob/c0c0cf6/libs/plaited/src/class-names.ts#L3)

___

### createTemplate

▸ **createTemplate**<`T`\>(`tag`, `attrs`): [`Template`](plaited.index.md#template)

createTemplate function used for ssr

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `Record`<`string`, `any`\> |

#### Parameters

| Name | Type |
| :------ | :------ |
| `tag` | `Tag` |
| `attrs` | [`Attrs`](plaited.index.md#attrs)<`T`\> |

#### Returns

[`Template`](plaited.index.md#template)

#### Defined in

libs/jsx/dist/types.d.ts:27

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

### getTriggerKey

▸ **getTriggerKey**(`e`, `context`): `string`

#### Parameters

| Name | Type |
| :------ | :------ |
| `e` | `Event` |
| `context` | `HTMLElement` \| `SVGElement` |

#### Returns

`string`

#### Defined in

[libs/plaited/src/isle.ts:22](https://github.com/plaited/plaited/blob/c0c0cf6/libs/plaited/src/isle.ts#L22)

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
| `template` | <T\>(`props`: `T`) => [`Template`](plaited.index.md#template) |

#### Defined in

[libs/plaited/src/isle.ts:66](https://github.com/plaited/plaited/blob/c0c0cf6/libs/plaited/src/isle.ts#L66)

___

### loop

▸ **loop**(`rules`, `condition?`): [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\>

**`Description`**

A behavioral thread that loops infinitely or until some callback condition is false
like a mode change open -> close. This function returns a threads

#### Parameters

| Name | Type |
| :------ | :------ |
| `rules` | [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\>[] |
| `condition?` | () => `boolean` |

#### Returns

[`RulesFunc`](plaited.index.md#rulesfunc)<`any`\>

#### Defined in

libs/behavioral/dist/rules.d.ts:12

___

### matchAllEvents

▸ **matchAllEvents**(`str`): `string`[]

#### Parameters

| Name | Type |
| :------ | :------ |
| `str` | `string` |

#### Returns

`string`[]

#### Defined in

[libs/plaited/src/isle.ts:15](https://github.com/plaited/plaited/blob/c0c0cf6/libs/plaited/src/isle.ts#L15)

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

[libs/plaited/src/memo.ts:20](https://github.com/plaited/plaited/blob/c0c0cf6/libs/plaited/src/memo.ts#L20)

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

### sync

▸ **sync**<`T`\>(`set`): [`RulesFunc`](plaited.index.md#rulesfunc)<`T`\>

**`Description`**

At synchronization points, each behavioral thread specifies three sets of events:
requested events: the threads proposes that these be considered for triggering,
and asks to be notified when any of them occurs; waitFor events: the threads does not request these, but
asks to be notified when any of them is triggered; and blocked events: the
threads currently forbids triggering
any of these events.

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

#### Defined in

libs/behavioral/dist/rules.d.ts:22

___

### thread

▸ **thread**(`...rules`): [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\>

**`Description`**

creates a behavioral thread from synchronization sets and/or other  behavioral threads

#### Parameters

| Name | Type |
| :------ | :------ |
| `...rules` | [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\>[] |

#### Returns

[`RulesFunc`](plaited.index.md#rulesfunc)<`any`\>

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

[libs/plaited/src/use-indexed-db.ts:13](https://github.com/plaited/plaited/blob/c0c0cf6/libs/plaited/src/use-indexed-db.ts#L13)

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

[libs/plaited/src/use-main.ts:6](https://github.com/plaited/plaited/blob/c0c0cf6/libs/plaited/src/use-main.ts#L6)

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

[libs/plaited/src/use-messenger.ts:24](https://github.com/plaited/plaited/blob/c0c0cf6/libs/plaited/src/use-messenger.ts#L24)

___

### useStore

▸ **useStore**<`T`\>(`initialStore`): readonly [`Get`<`T`\>, `Set`<`T`\>]

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

#### Type parameters

| Name |
| :------ |
| `T` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `initialStore` | `T` |

#### Returns

readonly [`Get`<`T`\>, `Set`<`T`\>]

#### Defined in

[libs/plaited/src/use-store.ts:27](https://github.com/plaited/plaited/blob/c0c0cf6/libs/plaited/src/use-store.ts#L27)

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

[libs/plaited/src/use-sugar.ts:79](https://github.com/plaited/plaited/blob/c0c0cf6/libs/plaited/src/use-sugar.ts#L79)
