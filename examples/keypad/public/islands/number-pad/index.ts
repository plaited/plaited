import { defineComponent } from '@plaited/island'
import { send } from '../comms'

defineComponent('number-pad', base => class extends base {
  constructor() {
    super()
  }
  number(evt:MouseEvent){
    const val = (evt.currentTarget as HTMLButtonElement)?.value
    send('number-display', {
      eventName: `addNumber-${val}`,
      payload: val,
    })
  }
  clear() {
    send('number-display', {
      eventName: 'clear',
    })
  }
})
