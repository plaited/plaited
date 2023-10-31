**plaited** ( [Readme](../../README.md) \| API )

***

[Plaited Typedocs](../../../modules.md) / [plaited](../../modules.md) / [index](../README.md) / useMessenger

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
  connect: (recipient: string, trigger: [Trigger](../type-aliases/Trigger.md)) => ()=> void),
  send: (recipient: string, detail: [TriggerArgs](../type-aliases/TriggerArgs.md)) => void
  worker: (id: string, url: string) =>  ()=> void)
}

## Source

libs/component/dist/use-messenger.d.ts:12

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
