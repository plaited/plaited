/* eslint-disable no-console */
import { defineIsland, usePlait, BaseIsland, Query, PlaitedReturn } from '@plaited/island'
import {
  strand,
  loop,
  waitFor,
  request,
  TriggerFunc,
} from '@plaited/behavioral'
import { connect } from '../comms'
  
interface NumberDisplay extends BaseIsland {
  display: string[]
  setDisplay: (val: string[]) => void
}


defineIsland('number-display', base => class extends base implements NumberDisplay {
  constructor() {
    super()
  }
  #display: string[] = []
  setDisplay(val: string[]) {
    if(val.length < 5) {
      this.#display = val
    }
  }
  get display() {
    return this.#display
  }
  plait($:Query, context: this): PlaitedReturn{
    const strands = {
      onClear: loop(strand(
        waitFor({ eventName: 'clear' }),
        request({ eventName: 'clearDisplay' })
      )),
      ...[ ...Array(10).keys() ].reduce((acc, cur) => {
        Object.assign(acc, {
          [`onClick:${cur}`]: loop(strand(
            waitFor({ eventName: `addNumber-${cur}` }),
            request({ eventName: 'updateNumber', payload: cur })
          )),
        })
        return acc
      },{}),
      onLog: loop(strand(
        waitFor({ eventName: 'logMe' }),
        request({ eventName: 'logSelf' })
      )),
    }
    
    const updateDisplay = (target: Element, arr: string[]) => {
      target.replaceChildren(`${arr[3] || 0}${arr[2] || 0}:${arr[1] || 0}${arr[0] || 0}`)
    }
    
    const actions = {
      updateNumber(payload: string){
        if(context.display.length < 5) {
          context.setDisplay([ ...context.display, payload ])
        }
        const [ display ] = $('display')
        updateDisplay(display, context.display)
      },
      clearDisplay(){
        const [ display ] = $('display')
        display.replaceChildren('00:00')
        context.setDisplay([])
      },
      logSelf(){
        console.log('hit')
      },
    }
    return usePlait<NumberDisplay>({
      context,
      actions,
      strands,
      connect,
    })
  }
  test(evet: MouseEvent, trigger: TriggerFunc) {
    trigger({
      eventName: 'logMe',
    })
  }
})

