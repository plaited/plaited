/* eslint-disable no-console */
import { Actions, useStore, defineIsland } from '@plaited/island'
import {
  block,
  strand,
  loop,
  waitFor,
  request,
} from '@plaited/behavioral'
import {
  // comms
  connect,
  // islandNames
  microwaveDisplay,
  //events
  add30Seconds,
  addToTimeArray,
  startClock,
  pauseClock,
  resetClock,
  stopResetTrigger,
} from '../../shared'
import {
  pausedMode,
  runningMode,
  readyMode,
} from './modes'

const [ getMode, setMode ] = useStore(readyMode)
const [ getTime, setTime ] = useStore<string[]>([])
const strands = {
  onPause: loop(strand(
    waitFor({ callback: ({ eventName }) =>  (
      getMode() === runningMode && eventName === stopResetTrigger
    ) }),
    request({ eventName: pauseClock })
  )),
  onReset: loop(strand(
    waitFor({ callback: ({ eventName }) =>  (
      getMode() === pausedMode && eventName === stopResetTrigger
    ) }),
    request({ eventName: resetClock })
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
  [startClock](){
    console.log(getTime().length )
    console.log(startClock)
    setMode(runningMode)
  },
  [pauseClock](){
    console.log(pauseClock)
    setMode(pausedMode)
  },
  [resetClock](){
    console.log(resetClock)
    setMode(readyMode)
    setTime([])
    updateDisplay(root.querySelector('[data-target="display"]'), getTime())
  },
  [add30Seconds](){
    console.log(add30Seconds)
  },
})

defineIsland({ tag: microwaveDisplay,  strands, actions, connect })

