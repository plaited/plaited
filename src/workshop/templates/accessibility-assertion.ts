export const accessibilityAssertion = (fixture: string) => `const results = await new AxeBuilder({ page }).options({}).include('${fixture}').analyze()
expect(results.violations).toHaveLength(0)`
