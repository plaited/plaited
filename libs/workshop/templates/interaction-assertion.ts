export const interactionAssertion = (name: string, id: string) =>
  `if (${name}.test) {
      await ${name}?.test({locator, expect, id: '${id}'})
    }`
