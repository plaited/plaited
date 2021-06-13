/* eslint-disable no-console */
import {
  register,
  block,
  strand,
  loop,
  waitFor,
  request,
  useStore,
} from '../../../../src'
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

const [getMode, setMode] = useStore(readyMode)
const [getTime, setTime] = useStore([])
const strands = {
  onPause: loop(strand(
    waitFor({callback: ({eventName}) =>  (
      getMode() === runningMode && eventName === stopResetTrigger
    )}),
    request({eventName: pauseClock}),
  )),
  onReset: loop(strand(
    waitFor({callback: ({eventName}) =>  (
      getMode() === pausedMode && eventName === stopResetTrigger
    )}),
    request({eventName: resetClock}),
  )),
  whileRunning: loop(strand(
    block(
      {callback: ({eventName}) =>  (
        getMode() === runningMode && eventName === startClock
      )},
      {callback: ({eventName}) =>  (
        getMode() === runningMode && eventName === addToTimeArray
      )},
    ),
  )),
  whilePaused: loop(strand(
    block(
      {callback: ({eventName}) =>  (
        getMode() === pausedMode && eventName === addToTimeArray
      )},
    ),
  )),
  whileTimeIsMaxed: loop(
    strand(
      block(
        {callback: ({eventName}) =>(
          eventName === addToTimeArray && getTime().length === 4
        )},
      ),
    ),
  ),
  whileTimeIsEmpty: loop(
    strand(
      block({callback: ({eventName}) => (
        eventName === startClock && getTime().length === 0
      )}),
    ),
  ),
}

const updateDisplay = (target, arr) => {
  target.replaceChildren(`${arr[3] || 0}${arr[2] || 0}:${arr[1] || 0}${arr[0] || 0}`)
}

const actions = target =>  ({

  [addToTimeArray](payload){
    console.log(addToTimeArray)
    const time = [...getTime()]
    time.push(payload)
    setTime(time)
    updateDisplay(target('display'), getTime())
  },
  [startClock](){
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
    updateDisplay(target('display'), getTime())
  },
  [add30Seconds](){
    console.log(add30Seconds)
  },

})

register(microwaveDisplay, {strands, actions, connect})

