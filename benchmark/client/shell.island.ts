import { isle, PlaitProps } from '$plaited'
import { send } from './comms.ts'
import { ShellTag, TableTag } from './constants.ts'
export const Shell = isle(
  { tag: ShellTag },
  class extends HTMLElement {
    plait({ feedback }: PlaitProps) {
      feedback({
        run() {
          send(TableTag, { type: 'run' })
        },
        runLots() {
          send(TableTag, { type: 'runLots' })
        },
        add() {
          send(TableTag, { type: 'add' })
        },
        update() {
          send(TableTag, { type: 'update' })
        },
        clear() {
          send(TableTag, { type: 'clear' })
        },
        swapRows() {
          send(TableTag, { type: 'swapRows' })
        },
      })
    }
  },
)
