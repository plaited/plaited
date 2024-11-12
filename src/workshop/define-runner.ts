import { defineModule } from '../server/define-module.js'

export const getRunner = ({ id, publicEvents }: { id: string; publicEvents: string[] }) => {
  const connect = defineModule({
    id,
    publicEvents,
    bProgram() {
      return {}
    },
  })
}
