export const interactionAssertion = (name: string, id: string) =>
  `if (${name}.play) {
      await ${name}?.play({page, expect, id: '${id}'})
    }`
