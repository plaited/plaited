import { html } from '$plaited'
import { classes, styles } from './shadow.styles.ts'
import { ShadowIsland } from './shadow.island.ts'
export const ShadowTemplate = ShadowIsland.template({
  styles,
  shadow: html`<div class="${classes.mount}" data-target="wrapper">
    <div class="${classes.zone}" data-target="zone">
      
    </div>
    <div class="${classes.row}" data-target="button-row">
      <button data-trigger="click->start" class="${classes.button}">start</button>
      <button data-trigger="click->addButton" class="${classes.button}">addButton</button>
    </div>
  </div>`,
})
