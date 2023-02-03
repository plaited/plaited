export const visualComparisonAssertion = (fixture: string, id: string) =>
  `const locator = page.locator(${fixture})
expect(locator).toMatchSnapshot('${id}.png')`
