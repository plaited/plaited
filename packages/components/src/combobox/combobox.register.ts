import { defineIsland, BaseIsland } from '@plaited/island'
import { tag } from './combobox.tags'

defineIsland({
  tag,
  mixin: (base: BaseIsland) => class extends base {
    static formAssociated = true
    constructor() {
      super()
    }
  },
})
