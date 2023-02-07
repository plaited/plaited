export const accessibilityAssertion = (island: string) =>
  `const results = await new AxeBuilder({ page }).options({}).include('${island}').analyze()
  expect(results.violations).toHaveLength(0)`
