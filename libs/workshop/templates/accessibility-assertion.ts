import { fixture } from '../constants.ts'
export const accessibilityAssertion = () =>
  `const results = await new AxeBuilder({ page }).options({}).include('${fixture}').analyze()
    expect(results.violations).toHaveLength(0)`
