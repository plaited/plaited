import {Callback, IdiomSet, RulesFunc} from './types'


const idiom = (key:'waitFor' | 'block')  => (...idioms: {
  eventName?: string
  callback?: Callback
}[]) => {
  return {
    [key]: [...idioms],
  }
}
export const waitFor = idiom('waitFor')
export const block = idiom('block')
export const request = (...idioms: {
  eventName: string;
  payload?: unknown;
  callback?: Callback;
}[]) => {
  return {
    request: [...idioms],
  }
}


export const delegate = (...gens: RulesFunc[]): RulesFunc => function* () {
  for(const gen of gens){
    yield* gen()
  }
}

export const loop = (gen: RulesFunc, callback = () => true) => function* ()  {
  while (callback()) {
    yield* gen()
  }
}

export const strand = (...idiomSets: IdiomSet[]): RulesFunc =>
  function* ()  {
    for (const set of idiomSets) {
      yield set
    }
  }
