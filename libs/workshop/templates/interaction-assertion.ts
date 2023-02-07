export const interactionAssertion = (name: string, id: string) =>
  `await ${name}?.play({page, expect, id: '${id}'})`
