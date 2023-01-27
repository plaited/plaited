import { usePlait, BaseElement } from '@plaited/island'
import { send } from '../comms.js'
// @ts-ignore: test
window.streamLog = []
class KeyPad extends BaseElement {
  plait(){
    const logger = (msg: unknown) => {
      // @ts-ignore: test
      window.streamLog.push(msg)
    }
    const actions = {
      number(evt:MouseEvent){
        const val = (evt.currentTarget as HTMLButtonElement)?.value
        send('value-display', {
          eventName: `addNumber-${val}`,
          payload: val,
        })
      },
      clear() {
        send('value-display', {
          eventName: 'clear',
        })
      },
    }
    return usePlait({
      actions,
      logger,
    })
  }
}
KeyPad.define('key-pad')
