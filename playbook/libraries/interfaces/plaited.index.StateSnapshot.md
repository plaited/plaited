[Plaited Typedocs](../README.md) / [Modules](../modules.md) / [plaited](../modules/plaited.md) / [index](../modules/plaited.index.md) / StateSnapshot

# Interface: StateSnapshot

[plaited](../modules/plaited.md).[index](../modules/plaited.index.md).StateSnapshot

## Callable

### StateSnapshot

▸ **StateSnapshot**(`props`): { `block?`: [`ParameterIdiom`](../modules/plaited.index.md#parameteridiom)<`unknown`\>[] ; `priority`: `number` ; `request?`: [`RequestIdiom`](../modules/plaited.index.md#requestidiom)<`unknown`\>[] ; `thread`: `string` ; `waitFor?`: [`ParameterIdiom`](../modules/plaited.index.md#parameteridiom)<`unknown`\>[]  }[]

#### Parameters

| Name | Type |
| :------ | :------ |
| `props` | `Object` |
| `props.bids` | [`PendingBid`](../modules/plaited.index.md#pendingbid)[] |
| `props.selectedEvent` | [`CandidateBid`](../modules/plaited.index.md#candidatebid) |

#### Returns

{ `block?`: [`ParameterIdiom`](../modules/plaited.index.md#parameteridiom)<`unknown`\>[] ; `priority`: `number` ; `request?`: [`RequestIdiom`](../modules/plaited.index.md#requestidiom)<`unknown`\>[] ; `thread`: `string` ; `waitFor?`: [`ParameterIdiom`](../modules/plaited.index.md#parameteridiom)<`unknown`\>[]  }[]

#### Defined in

libs/behavioral/dist/types.d.ts:2
