import { html, IslandTemplate } from '$plaited'
import { classes } from './value-display.styles.ts'

export const ValueDisplayTemplate = IslandTemplate({
  tag: 'value-display',
  template:
    html`<h1 data-target="display" class="${classes.display}" data-trigger="click->test">00:00</h1>`,
})
