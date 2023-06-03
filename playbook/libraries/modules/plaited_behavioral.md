[Plaited Typedocs](../README.md) / [Exports](../modules.md) / @plaited/behavioral

# Module: @plaited/behavioral

## Table of contents

### Interfaces

- [DevCallback](../interfaces/plaited_behavioral.DevCallback.md)
- [StateSnapshot](../interfaces/plaited_behavioral.StateSnapshot.md)

### Type Aliases

- [CandidateBid](plaited_behavioral.md#candidatebid)
- [Detail](plaited_behavioral.md#detail)
- [Feedback](plaited_behavioral.md#feedback)
- [ParameterIdiom](plaited_behavioral.md#parameteridiom)
- [PendingBid](plaited_behavioral.md#pendingbid)
- [RequestIdiom](plaited_behavioral.md#requestidiom)
- [RuleSet](plaited_behavioral.md#ruleset)
- [RulesFunc](plaited_behavioral.md#rulesfunc)
- [RunningBid](plaited_behavioral.md#runningbid)
- [SelectedMessage](plaited_behavioral.md#selectedmessage)
- [SnapshotMessage](plaited_behavioral.md#snapshotmessage)
- [Strategy](plaited_behavioral.md#strategy)
- [Trigger](plaited_behavioral.md#trigger)
- [TriggerArgs](plaited_behavioral.md#triggerargs)

### Functions

- [bProgram](plaited_behavioral.md#bprogram)
- [loop](plaited_behavioral.md#loop)
- [sync](plaited_behavioral.md#sync)
- [thread](plaited_behavioral.md#thread)

## Type Aliases

### CandidateBid

Ƭ **CandidateBid**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `cb?` | `Callback` |
| `detail?` | [`Detail`](plaited_behavioral.md#detail) |
| `priority` | `number` |
| `type` | `string` |

#### Defined in

[types.ts:81](https://github.com/plaited/plaited/blob/46fad8b/libs/behavioral/src/types.ts#L81)

___

### Detail

Ƭ **Detail**: `unknown` \| () => `unknown` \| `Event`

#### Defined in

[types.ts:16](https://github.com/plaited/plaited/blob/46fad8b/libs/behavioral/src/types.ts#L16)

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

[types.ts:104](https://github.com/plaited/plaited/blob/46fad8b/libs/behavioral/src/types.ts#L104)

___

### ParameterIdiom

Ƭ **ParameterIdiom**<`T`\>: { `cb?`: `Callback`<`T`\> ; `type`: `string`  } \| { `cb`: `Callback`<`T`\> ; `type?`: `string`  }

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`Detail`](plaited_behavioral.md#detail) = [`Detail`](plaited_behavioral.md#detail) |

#### Defined in

[types.ts:42](https://github.com/plaited/plaited/blob/46fad8b/libs/behavioral/src/types.ts#L42)

___

### PendingBid

Ƭ **PendingBid**: [`RuleSet`](plaited_behavioral.md#ruleset) & [`RunningBid`](plaited_behavioral.md#runningbid)

#### Defined in

[types.ts:79](https://github.com/plaited/plaited/blob/46fad8b/libs/behavioral/src/types.ts#L79)

___

### RequestIdiom

Ƭ **RequestIdiom**<`T`\>: `Object`

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`Detail`](plaited_behavioral.md#detail) = [`Detail`](plaited_behavioral.md#detail) |

#### Type declaration

| Name | Type |
| :------ | :------ |
| `detail?` | `T` |
| `type` | `string` |

#### Defined in

[types.ts:52](https://github.com/plaited/plaited/blob/46fad8b/libs/behavioral/src/types.ts#L52)

___

### RuleSet

Ƭ **RuleSet**<`T`\>: `Object`

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`Detail`](plaited_behavioral.md#detail) = [`Detail`](plaited_behavioral.md#detail) |

#### Type declaration

| Name | Type |
| :------ | :------ |
| `block?` | [`ParameterIdiom`](plaited_behavioral.md#parameteridiom)<`T`\> \| [`ParameterIdiom`](plaited_behavioral.md#parameteridiom)<`T`\>[] |
| `request?` | [`RequestIdiom`](plaited_behavioral.md#requestidiom)<`T`\> \| [`RequestIdiom`](plaited_behavioral.md#requestidiom)<`T`\>[] |
| `waitFor?` | [`ParameterIdiom`](plaited_behavioral.md#parameteridiom)<`T`\> \| [`ParameterIdiom`](plaited_behavioral.md#parameteridiom)<`T`\>[] |

#### Defined in

[types.ts:59](https://github.com/plaited/plaited/blob/46fad8b/libs/behavioral/src/types.ts#L59)

___

### RulesFunc

Ƭ **RulesFunc**<`T`\>: () => `IterableIterator`<[`RuleSet`](plaited_behavioral.md#ruleset)<`T`\>\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`Detail`](plaited_behavioral.md#detail) = [`Detail`](plaited_behavioral.md#detail) |

#### Type declaration

▸ (): `IterableIterator`<[`RuleSet`](plaited_behavioral.md#ruleset)<`T`\>\>

##### Returns

`IterableIterator`<[`RuleSet`](plaited_behavioral.md#ruleset)<`T`\>\>

#### Defined in

[types.ts:67](https://github.com/plaited/plaited/blob/46fad8b/libs/behavioral/src/types.ts#L67)

___

### RunningBid

Ƭ **RunningBid**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `generator` | `IterableIterator`<[`RuleSet`](plaited_behavioral.md#ruleset)\> |
| `priority` | `number` |
| `thread` | `string` |
| `trigger?` | ``true`` |

#### Defined in

[types.ts:73](https://github.com/plaited/plaited/blob/46fad8b/libs/behavioral/src/types.ts#L73)

___

### SelectedMessage

Ƭ **SelectedMessage**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `detail?` | [`Detail`](plaited_behavioral.md#detail) |
| `type` | `string` |

#### Defined in

[types.ts:20](https://github.com/plaited/plaited/blob/46fad8b/libs/behavioral/src/types.ts#L20)

___

### SnapshotMessage

Ƭ **SnapshotMessage**: `ReturnType`<[`StateSnapshot`](../interfaces/plaited_behavioral.StateSnapshot.md)\>

#### Defined in

[types.ts:18](https://github.com/plaited/plaited/blob/46fad8b/libs/behavioral/src/types.ts#L18)

___

### Strategy

Ƭ **Strategy**: (`filteredEvents`: [`CandidateBid`](plaited_behavioral.md#candidatebid)[] \| `never`[]) => [`CandidateBid`](plaited_behavioral.md#candidatebid) \| `undefined`

#### Type declaration

▸ (`filteredEvents`): [`CandidateBid`](plaited_behavioral.md#candidatebid) \| `undefined`

##### Parameters

| Name | Type |
| :------ | :------ |
| `filteredEvents` | [`CandidateBid`](plaited_behavioral.md#candidatebid)[] \| `never`[] |

##### Returns

[`CandidateBid`](plaited_behavioral.md#candidatebid) \| `undefined`

#### Defined in

[types.ts:88](https://github.com/plaited/plaited/blob/46fad8b/libs/behavioral/src/types.ts#L88)

___

### Trigger

Ƭ **Trigger**: <T\>(`args`: [`TriggerArgs`](plaited_behavioral.md#triggerargs)<`T`\>) => `void`

#### Type declaration

▸ <`T`\>(`args`): `void`

##### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`Detail`](plaited_behavioral.md#detail) = [`Detail`](plaited_behavioral.md#detail) |

##### Parameters

| Name | Type |
| :------ | :------ |
| `args` | [`TriggerArgs`](plaited_behavioral.md#triggerargs)<`T`\> |

##### Returns

`void`

#### Defined in

[types.ts:25](https://github.com/plaited/plaited/blob/46fad8b/libs/behavioral/src/types.ts#L25)

___

### TriggerArgs

Ƭ **TriggerArgs**<`T`\>: `Object`

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`Detail`](plaited_behavioral.md#detail) = [`Detail`](plaited_behavioral.md#detail) |

#### Type declaration

| Name | Type |
| :------ | :------ |
| `detail?` | `T` |
| `type` | `string` |

#### Defined in

[types.ts:29](https://github.com/plaited/plaited/blob/46fad8b/libs/behavioral/src/types.ts#L29)

## Functions

### bProgram

▸ **bProgram**(`«destructured»?`): `Readonly`<{ `addThreads`: (`threads`: `Record`<`string`, [`RulesFunc`](plaited_behavioral.md#rulesfunc)\>) => `void` ; `feedback`: [`Feedback`](plaited_behavioral.md#feedback) ; `loop`: (`rules`: [`RulesFunc`](plaited_behavioral.md#rulesfunc)<`any`\>[], `condition`: () => `boolean`) => [`RulesFunc`](plaited_behavioral.md#rulesfunc)<`any`\> ; `sync`: <T\>(`set`: [`RuleSet`](plaited_behavioral.md#ruleset)<`T`\>) => [`RulesFunc`](plaited_behavioral.md#rulesfunc)<`T`\> ; `thread`: (...`rules`: [`RulesFunc`](plaited_behavioral.md#rulesfunc)<`any`\>[]) => [`RulesFunc`](plaited_behavioral.md#rulesfunc)<`any`\> ; `trigger`: [`Trigger`](plaited_behavioral.md#trigger)  }\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `«destructured»` | `Object` |
| › `dev?` | [`DevCallback`](../interfaces/plaited_behavioral.DevCallback.md) |
| › `strategy?` | ``"priority"`` \| ``"randomized"`` \| ``"chaos"`` \| [`Strategy`](plaited_behavioral.md#strategy) |

#### Returns

`Readonly`<{ `addThreads`: (`threads`: `Record`<`string`, [`RulesFunc`](plaited_behavioral.md#rulesfunc)\>) => `void` ; `feedback`: [`Feedback`](plaited_behavioral.md#feedback) ; `loop`: (`rules`: [`RulesFunc`](plaited_behavioral.md#rulesfunc)<`any`\>[], `condition`: () => `boolean`) => [`RulesFunc`](plaited_behavioral.md#rulesfunc)<`any`\> ; `sync`: <T\>(`set`: [`RuleSet`](plaited_behavioral.md#ruleset)<`T`\>) => [`RulesFunc`](plaited_behavioral.md#rulesfunc)<`T`\> ; `thread`: (...`rules`: [`RulesFunc`](plaited_behavioral.md#rulesfunc)<`any`\>[]) => [`RulesFunc`](plaited_behavioral.md#rulesfunc)<`any`\> ; `trigger`: [`Trigger`](plaited_behavioral.md#trigger)  }\>

#### Defined in

[b-program.ts:39](https://github.com/plaited/plaited/blob/46fad8b/libs/behavioral/src/b-program.ts#L39)

___

### loop

▸ **loop**(`rules`, `condition?`): [`RulesFunc`](plaited_behavioral.md#rulesfunc)<`any`\>

**`Description`**

A behavioral thread that loops infinitely or until some callback condition is false
like a mode change open -> close. This function returns a threads

#### Parameters

| Name | Type |
| :------ | :------ |
| `rules` | [`RulesFunc`](plaited_behavioral.md#rulesfunc)<`any`\>[] |
| `condition` | () => `boolean` |

#### Returns

[`RulesFunc`](plaited_behavioral.md#rulesfunc)<`any`\>

#### Defined in

[rules.ts:19](https://github.com/plaited/plaited/blob/46fad8b/libs/behavioral/src/rules.ts#L19)

___

### sync

▸ **sync**<`T`\>(`set`): [`RulesFunc`](plaited_behavioral.md#rulesfunc)<`T`\>

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
| `set` | [`RuleSet`](plaited_behavioral.md#ruleset)<`T`\> |

#### Returns

[`RulesFunc`](plaited_behavioral.md#rulesfunc)<`T`\>

#### Defined in

[rules.ts:39](https://github.com/plaited/plaited/blob/46fad8b/libs/behavioral/src/rules.ts#L39)

___

### thread

▸ **thread**(`...rules`): [`RulesFunc`](plaited_behavioral.md#rulesfunc)<`any`\>

**`Description`**

creates a behavioral thread from synchronization sets and/or other  behavioral threads

#### Parameters

| Name | Type |
| :------ | :------ |
| `...rules` | [`RulesFunc`](plaited_behavioral.md#rulesfunc)<`any`\>[] |

#### Returns

[`RulesFunc`](plaited_behavioral.md#rulesfunc)<`any`\>

#### Defined in

[rules.ts:8](https://github.com/plaited/plaited/blob/46fad8b/libs/behavioral/src/rules.ts#L8)
