// import { z } from 'zod'
import { bServer } from './b-server.js'
import { registry } from './workshop.registry.js'

export const workshop = bServer({
  name: 'plaited-workshop',
  version: '0.0.1',
  registry,
  async bProgram() {
    return {}
  },
})
