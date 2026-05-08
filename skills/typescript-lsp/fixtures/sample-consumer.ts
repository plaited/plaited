import { type Config, parseConfig } from '../tests/fixtures/sample.ts'

export const formatConfig = (input: string): Config => {
  return parseConfig(input)
}
