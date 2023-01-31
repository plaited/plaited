export type TestDescribeTemplateArgs = {
  colorScheme: boolean
  name: string
  tests: string
}

export type TestDescribeTemplate = <T extends TestDescribeTemplateArgs = TestDescribeTemplateArgs>(args:T) => string

export const testDescribePre = (name: string) => `test.describe('${name}`

export const testDescribe:TestDescribeTemplate = ({
  colorScheme = true,
  name,
  tests,
}) => `${testDescribePre(name)}${colorScheme ? '(light)' : ''}', () => {
  test.use({ colorScheme: ${colorScheme ? 'light' : 'normal'} })

  ${tests}
});
${colorScheme ? `${testDescribePre(name)}${colorScheme ? '(light)' : ''}', () => {
  test.use({ colorScheme: 'dark' })

  ${tests}
});` : ''}`
