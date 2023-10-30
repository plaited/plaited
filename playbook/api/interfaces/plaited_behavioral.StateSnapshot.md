[Plaited Typedocs](../README.md) / [Exports](../modules.md) / [@plaited/behavioral](../modules/plaited_behavioral.md) / StateSnapshot

# Interface: StateSnapshot

[@plaited/behavioral](../modules/plaited_behavioral.md).StateSnapshot

## Callable

### StateSnapshot

▸ **StateSnapshot**(`props`): { `block?`: [`ParameterIdiom`](../modules/plaited_behavioral.md#parameteridiom)<`unknown`\>[] ; `priority`: `number` ; `request?`: [`RequestIdiom`](../modules/plaited_behavioral.md#requestidiom)<`unknown`\>[] ; `thread`: `string` ; `waitFor?`: [`ParameterIdiom`](../modules/plaited_behavioral.md#parameteridiom)<`unknown`\>[]  }[]

#### Parameters

| Name | Type |
| :------ | :------ |
| `props` | `Object` |
| `props.bids` | [`PendingBid`](../modules/plaited_behavioral.md#pendingbid)[] |
| `props.selectedEvent` | [`CandidateBid`](../modules/plaited_behavioral.md#candidatebid) |

#### Returns

{ `block?`: [`ParameterIdiom`](../modules/plaited_behavioral.md#parameteridiom)<`unknown`\>[] ; `priority`: `number` ; `request?`: [`RequestIdiom`](../modules/plaited_behavioral.md#requestidiom)<`unknown`\>[] ; `thread`: `string` ; `waitFor?`: [`ParameterIdiom`](../modules/plaited_behavioral.md#parameteridiom)<`unknown`\>[]  }[]

#### Defined in

[types.ts:2](https://github.com/plaited/plaited/blob/39779d0/libs/behavioral/src/types.ts#L2)
