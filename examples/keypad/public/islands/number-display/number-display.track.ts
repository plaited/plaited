import { Track } from '@plaited/island'

const strands = {
  onClear: loop(strand(
    waitFor({ eventName: 'clear' }),
    request({ eventName: 'clear' })
  )),
  whileRunning: loop(strand(
    block(
      { callback: ({ eventName }) =>  (
        getMode() === runningMode && eventName === startClock
      ) },
      { callback: ({ eventName }) =>  (
        getMode() === runningMode && eventName === addToTimeArray
      ) }
    )
  )),
  whilePaused: loop(strand(
    block(
      { callback: ({ eventName }) =>  (
        getMode() === pausedMode && eventName === addToTimeArray
      ) }
    )
  )),
  whileTimeIsMaxed: loop(
    strand(
      block(
        { callback: ({ eventName }) =>(
          eventName === addToTimeArray && getTime().length === 4
        ) }
      )
    )
  ),
  whileTimeIsEmpty: loop(
    strand(
      Object.assign(
        block({ callback: ({ eventName }) => (
          eventName === resetClock && getTime().length === 0
        ) }),
        block({ callback: ({ eventName }) => (
          eventName === startClock && getTime().length === 0
        ) })
      )
    )
  ),
}

const updateDisplay = (target, arr) => {
  target.replaceChildren(`${arr[3] || 0}${arr[2] || 0}:${arr[1] || 0}${arr[0] || 0}`)
}

const actions: Actions = ({ $, root }) =>  ({

  [addToTimeArray](payload: string){
    console.log(addToTimeArray)
    const time = [ ...getTime() ]
    time.push(payload)
    setTime(time)
    updateDisplay($('display')[0], getTime())
  },
  [resetClock](){
    console.log(resetClock)
    setMode(readyMode)
    setTime([])
    updateDisplay(root.querySelector('[data-target="display"]'), getTime())
  },
})

export const track = ({
  strands = {},
  actions,
  logger,
}) => (context: ShadowRoot) => {
  const { feedback, trigger, stream, add } = new Track(strands, { strategy, dev: Boolean(logger) })
  logger && stream.subscribe(logger)
  const $ = (id: string) => {
    return [ ...(context.querySelectorAll(`[${dataTarget}="${id}"]`)) ]
  }
  actions && feedback(actions({ $, root: this.#root }))
  return {
    trigger,
    add,
  }
}
