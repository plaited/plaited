import { defineIsland, BaseIsland } from '@plaited/island'

defineIsland({
  tag: 'button-fixture',
  mixin: (base: BaseIsland) => class extends base {
    static formAssociated = true
    constructor() {
      super()
    }
  },
})
