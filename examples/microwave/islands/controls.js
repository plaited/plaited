import {register, baseDynamics} from '../../../src'
import {
  // comms
  send,
  // constants
  microwaveDisplay,
  microwaveControls,
  // events
  startClock,
  stopResetTrigger,
  add30Seconds,
  add30Trigger,
  startTrigger,
  addToTimeArray,
} from '../shared'
const actions = () =>  ({
  ...[...Array(10).keys()].reduce((acc, cur) => {
    acc[`click->${cur}`] = () => {
      send(microwaveDisplay, {
        eventName: addToTimeArray,
        payload: cur,
        baseDynamic: baseDynamics.objectObject,
      })
    }
    return acc
  },{}),
  [add30Trigger](){
    send(microwaveDisplay, {
      eventName: add30Seconds,
      baseDynamic: baseDynamics.objectObject,
    })
  },
  [startTrigger](){
    send(microwaveDisplay, {
      eventName: startClock,
      baseDynamic: baseDynamics.objectObject,
    })
  },
  [stopResetTrigger](){
    send(microwaveDisplay, {
      eventName: stopResetTrigger,
      baseDynamic: baseDynamics.objectObject,
    })
  },
})
register(microwaveControls, {actions})
