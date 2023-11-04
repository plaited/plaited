**@plaited/component** ( [Readme](../README.md) \| API )

***

[Plaited Typedocs](../../../modules.md) / [@plaited/component](../modules.md) / useMessenger

# Function: useMessenger()

> **useMessenger**(`id`?): `Readonly`\<`object`\>

Enables communication between agents in a web app.
Agents can be Islands, workers, or behavioral program running in the main thread.
This allows for execution of the one-way message exchange pattern (aka
fire and forget).

## Parameters

▪ **id?**: `string`

## Returns

`Readonly`\<`object`\>

readonly {}
  connect: (recipient: string, trigger: [Trigger](../../behavioral/type-aliases/Trigger.md)) => ()=> void),
  send: (recipient: string, detail: [TriggerArgs](../../behavioral/type-aliases/TriggerArgs.md)) => void
  worker: (id: string, url: string) =>  ()=> void)
}

## Source

[libs/component/src/use-messenger.ts:13](https://github.com/plaited/plaited/blob/b151218/libs/component/src/use-messenger.ts#L13)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
