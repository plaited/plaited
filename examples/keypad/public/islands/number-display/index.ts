/* eslint-disable no-console */
import { Actions, defineIsland, getPlait, BaseElement, TriggerFunc } from '@plaited/island'
import {
  strand,
  loop,
  waitFor,
  request,
} from '@plaited/behavioral'
import { connect } from '../comms'


const strands = {
  onClear: loop(strand(
    waitFor({ eventName: 'clear' }),
    request({ eventName: 'clearDisplay' })
  )),
}

interface NumberDisplay extends BaseElement {
  display: string[]
  setDisplay: (val: string[]) => void
}

const updateDisplay = (target: Element, arr: string[]) => {
  target.replaceChildren(`${arr[3] || 0}${arr[2] || 0}:${arr[1] || 0}${arr[0] || 0}`)
}

const actions: Actions<NumberDisplay> = ($, context) =>  ({
  addNumber(payload: string){
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
  },
})


export const plait = getPlait({
  actions,
  strands,
  connect,
})

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

