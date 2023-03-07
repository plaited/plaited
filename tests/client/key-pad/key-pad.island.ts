import { define } from '$plaited'
import { send } from '../comms.ts'
define({ tag: 'key-pad' }, ({ feedback }) => {
  feedback({
    number(evt: MouseEvent) {
      const value = (evt.currentTarget as HTMLButtonElement)?.value
      send('value-display', {
        event: `addNumber`,
        detail: { value },
      })
    },
    clear() {
      send('value-display', {
        event: 'clear',
      })
    },
  })
})
