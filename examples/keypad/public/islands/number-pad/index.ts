import { defineComponent, usePlait, Query, Plaited } from '@plaited/island'
import { send } from '../comms'
// @ts-ignore: test
window.streamLog = []
defineComponent('number-pad', base => class extends base {
  constructor() {
    super()
  }
  plait(): Plaited{
    const logger = (msg: unknown) => {
      // @ts-ignore: test
      window.streamLog.push(msg)
    }
    const actions = {
      number(evt:MouseEvent){
        const val = (evt.currentTarget as HTMLButtonElement)?.value
        send('number-display', {
          eventName: `addNumber-${val}`,
          payload: val,
        })
      },
      clear() {
        send('number-display', {
          eventName: 'clear',
        })
      },
    }
    return usePlait({
      actions,
      logger,
    })
  }
})
