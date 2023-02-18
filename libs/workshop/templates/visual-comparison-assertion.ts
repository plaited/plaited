import { fixture } from '../constants.ts'
export const visualComparisonAssertion = (id: string) =>
  `const locator = page.locator('${fixture}')
    expect(locator).toMatchSnapshot('${id}.png')`
