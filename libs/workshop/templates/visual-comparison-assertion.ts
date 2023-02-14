export const visualComparisonAssertion = (island: string, id: string) =>
  `const locator = page.locator('${island}')
    expect(locator).toMatchSnapshot('${id}.png')`
