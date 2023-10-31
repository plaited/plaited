**@plaited/utils** ( [Readme](../README.md) \| API )

***

[Plaited Typedocs](../../../modules.md) / [@plaited/utils](../modules.md) / publisher

# Function: publisher()

> **publisher**\<`T`\>(): (`value`) => `void`

Creates a new publisher object.
A publisher object is a function that can be called with a value of type T,
which will notify all subscribed listeners with that value.
It also has a `subscribe` method that allows listeners to subscribe to the publisher.

## Type parameters

▪ **T**

## Returns

`object`

A new publisher object.

> > (`value`): `void`
>
> ### Parameters
>
> ▪ **value**: `T`
>
> ### Returns
>
> `void`
>
> ### Source
>
> [publisher.ts:11](https://github.com/plaited/plaited/blob/d85458a/libs/utils/src/publisher.ts#L11)
>

> ### subscribe()
>
> Subscribes a listener to the publisher.
>
> #### Parameters
>
> ▪ **listener**: (`msg`) => `void`
>
> The listener function to subscribe.
>
> #### Returns
>
> `function`
>
> A function that can be called to unsubscribe the listener.
>
> > > (): `boolean`
> >
> > ##### Returns
> >
> > `boolean`
> >
> > ##### Source
> >
> > [publisher.ts:24](https://github.com/plaited/plaited/blob/d85458a/libs/utils/src/publisher.ts#L24)
> >
>

## Source

[publisher.ts:8](https://github.com/plaited/plaited/blob/d85458a/libs/utils/src/publisher.ts#L8)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
