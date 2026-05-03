import { onlyUsedInTests, parseConfig } from '../../tests/fixtures/sample.ts'

export const runFixtureUsage = () => [parseConfig('fixture'), onlyUsedInTests()]
