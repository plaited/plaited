export const interactionAssertion = (name: string, id: string) =>
  `if (${name}.test) {
      await ${name}?.test({page, expect, id: '${id}'})
    }`
