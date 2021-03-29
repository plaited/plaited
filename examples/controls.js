import {register, baseDynamics} from '../src'
import {
  startClock,
  stopResetTrigger,
  add30Seconds,
  add30Trigger,
  startTrigger,
  addToTimeArray,
} from './events'
import {microwaveDisplay, microwaveControls} from './constants'
import {broadcast} from './comms'
const actions = () =>  ({
  ...[...Array(10).keys()].reduce((acc, cur) => {
    acc[`click->${cur}`] = () => {
      broadcast(microwaveDisplay, {
        eventName: addToTimeArray,
        payload: cur,
        baseDynamic: baseDynamics.objectObject,
      })
    }
    return acc
  },{}),
  [add30Trigger](){
    broadcast(microwaveDisplay, {
      eventName: add30Seconds,
      baseDynamic: baseDynamics.objectObject,
    })
  },
  [startTrigger](){
    broadcast(microwaveDisplay, {
      eventName: startClock,
      baseDynamic: baseDynamics.objectObject,
    })
  },
  [stopResetTrigger](){
    broadcast(microwaveDisplay, {
      eventName: stopResetTrigger,
      baseDynamic: baseDynamics.objectObject,
    })
  },
})
register(microwaveControls, {actions})
