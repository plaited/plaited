**@plaited/component** ( [Readme](../README.md) \| API )

***

[Plaited Typedocs](../../../modules.md) / [@plaited/component](../modules.md) / useIndexedDB

# Function: useIndexedDB()

> **useIndexedDB**\<`T`\>(`key`, `initialValue`?, `option`?): `Promise`\<readonly [`Get`\<`T`\>, `Set`\<`T`\>]\>

asynchronously get and set indexed db values

## Type parameters

▪ **T** = `unknown`

## Parameters

▪ **key**: `string`

key for stored value

▪ **initialValue?**: `T`

initial value can be null

▪ **option?**: `object`

you can actually pass it an reference to another indexedDB

▪ **option.databaseName?**: `string`

▪ **option.storeName?**: `string`

## Returns

`Promise`\<readonly [`Get`\<`T`\>, `Set`\<`T`\>]\>

## Source

[libs/component/src/use-indexed-db.ts:12](https://github.com/plaited/plaited/blob/d85458a/libs/component/src/use-indexed-db.ts#L12)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
