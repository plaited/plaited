/* eslint-disable no-console */
import { defineIsland, getPlait, BaseIsland, GetPlait } from '@plaited/island'
import {
  strand,
  loop,
  waitFor,
  request,
} from '@plaited/behavioral'
import { connect } from '../comms'

  
interface NumberDisplay extends BaseIsland {
  display: string[]
  setDisplay: (val: string[]) => void
}

const plait: GetPlait<NumberDisplay> = ($, context) => {
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
  }
  
  const updateDisplay = (target: Element, arr: string[]) => {
    target.replaceChildren(`${arr[3] || 0}${arr[2] || 0}:${arr[1] || 0}${arr[0] || 0}`)
  }
  
  const actions = {
    updateNumber(payload: string){
      if(context.display.length < 5) {
        console.log(payload)
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
  }
  return getPlait<NumberDisplay>({
    context,
    actions,
    strands,
    connect,
  })
}

defineIsland('number-display', base => class extends base implements NumberDisplay {
  constructor() {
    super()
  }
  #display: string[] = []
  #disconnect?: () => void 
  connectedCallback(): void {
    super.connectedCallback()
    const {  disconnect } = plait(this.$, this)
    this.#disconnect = disconnect
  }
  disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#disconnect && this.#disconnect()
  }
  setDisplay(val: string[]) {
    if(val.length < 5) {
      this.#display = val
    }
  }
  get display() {
    return this.#display
  }
})

