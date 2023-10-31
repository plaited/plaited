**@plaited/behavioral** ( [Readme](../README.md) \| API )

***

[Plaited Typedocs](../../../modules.md) / [@plaited/behavioral](../modules.md) / sync

# Function: sync()

> **sync**\<`T`\>(`set`): [`RulesFunc`](../type-aliases/RulesFunc.md)\<`T`\>

At synchronization points, each behavioral thread specifies three sets of events:
requested events: the threads proposes that these be considered for triggering,
and asks to be notified when any of them occurs; waitFor events: the threads does not request these, but
asks to be notified when any of them is triggered; and blocked events: the
threads currently forbids triggering
any of these events.

## Type parameters

▪ **T** extends `unknown`

## Parameters

▪ **set**: [`RuleSet`](../type-aliases/RuleSet.md)\<`T`\>

## Returns

[`RulesFunc`](../type-aliases/RulesFunc.md)\<`T`\>

## Source

[rules.ts:33](https://github.com/plaited/plaited/blob/0d4801d/libs/behavioral/src/rules.ts#L33)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
