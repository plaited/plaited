/* eslint-disable no-console */
import { 
  strand,
  loop,
  waitFor,
  request,
  usePlait,
  Query,
  useStore,
  BaseElement,
} from '@plaited/island'
import { connect } from '../comms.js'


class ValueDisplay extends BaseElement {
  plait($:Query, context: this){
    const [ getDisplay, setDisplay ] = useStore<string[]>([])
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
        if(getDisplay.length < 5) {
          setDisplay([ ...getDisplay(), payload ])
        }
        const [ display ] = $('display')
        updateDisplay(display, getDisplay())
      },
      clearDisplay(){
        const [ display ] = $('display')
        display.replaceChildren('00:00')
        setDisplay([])
      },
      logSelf(){
        console.log('hit')
      },
    }
    return usePlait({
      context,
      actions,
      strands,
      connect,
    })
  }
}

ValueDisplay.define('value-display')
