import { classes, ShadowIsland, stylesheet } from './shadow.island.tsx'

export const ShadowTemplate = () => (
  <ShadowIsland.template {...stylesheet}>
    <div class={classes.mount} data-target='wrapper'>
      <div class={classes.zone} data-target='zone'>
      </div>
      <div class={classes.row} data-target='button-row'>
        <button data-trigger={{ click: 'start' }} class={classes.button}>
          start
        </button>
        <button data-trigger={{ click: 'addButton' }} class={classes.button}>
          addButton
        </button>
      </div>
    </div>
  </ShadowIsland.template>
)
