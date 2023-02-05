import { Assertion, RuleSet, RulesFunc } from './types.ts'

const idiom = (key: 'waitFor' | 'block') =>
<T = unknown>(
  ...idioms: {
    type?: string
    assert?: Assertion<T>
  }[]
) => {
  return {
    [key]: [...idioms],
  }
}
export const waitFor = idiom('waitFor')
export const block = idiom('block')

export const request = <T extends { type: string; data: unknown }>(
  ...idioms: {
    type: T['type']
    data?: T['data']
    assert?: Assertion
  }[]
) => {
  return {
    request: [...idioms],
  }
}

export const delegate = (...gens: RulesFunc[]): RulesFunc =>
  function* () {
    for (const gen of gens) {
      yield* gen()
    }
  }

export const loop = (gen: RulesFunc, assert = () => true) =>
  function* () {
    while (assert()) {
      yield* gen()
    }
  }

export const strand = (...idiomSets: RuleSet[]): RulesFunc =>
  function* () {
    for (const set of idiomSets) {
      yield set
    }
  }
