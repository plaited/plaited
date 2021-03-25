import {bProgram} from './bProgram.js'
import {stream as s} from './stream.js'
import {streamEvents, selectionStrategies} from './constants.js'
export const loop = (gen, loopCallback = () => true) => function* () {
  while (loopCallback()) {
    yield* gen()
  }
}
export const strand = (...idiomSets) => function* () {
  for (const set of idiomSets) {
    yield set
  }
}
export const track = (strands, {strategy = selectionStrategies.priority, debug = false} = {}) => {
  const stream = s()
  const {running, trigger} = bProgram({stream, strategy, debug})
  const feedback = actions => stream.subscribe(({streamEvent, ...rest}) => {
    if (streamEvent !== streamEvents.select)
      return
    const {eventName, payload} = rest
    actions[eventName] && actions[eventName]({eventName, payload})
  })
  const add = logicStands => {
    for (const strandName in logicStands)
      running.add({
        strandName,
        priority: running.size + 1,
        logicStrand: logicStands[strandName](),
      })
  }
  add(strands)
  return Object.freeze({trigger, feedback, stream, add})
}
