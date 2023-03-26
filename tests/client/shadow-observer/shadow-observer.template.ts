import { html } from '$plaited'
import { classes, styles } from './shadow.styles.ts'
import { classes as testClasses, styles as testStyles } from '../test.styles.ts'
import { ShadowIsland } from './shadow.island.ts'
export const ShadowTemplate = ShadowIsland.template({
  styles: new Set([styles, testStyles]),
  shadow: html`<div class="${classes.mount}" data-target="wrapper">
    <div class="${classes.zone}" data-target="zone">
      
    </div>
    <div class="${testClasses.row}" data-target="button-row">
      <button data-trigger="click->start" class="${testClasses.button}">start</button>
      <button data-trigger="click->addButton" class="${testClasses.button}">addButton</button>
    </div>
  </div>`,
})
