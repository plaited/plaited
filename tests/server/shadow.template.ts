import { html, IslandTemplate } from '$plaited'
import { classes, styles } from '../client/shadow.styles.ts'
import {
  classes as testClasses,
  styles as testStyles,
} from '../client//test.styles.ts'

export const ShadowTemplate = IslandTemplate({
  styles: new Set([styles, testStyles]),
  tag: 'shadow-island',
  template: html`<div class="${classes.mount}" data-target="wrapper">
    <div class="${classes.zone}" data-target="zone">
      
    </div>
    <div class="${testClasses.row}" data-target="button-row">
      <button data-trigger="click->start" class="${testClasses.button}">start</button>
    </div>
  </div>`,
})
