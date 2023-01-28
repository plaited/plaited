import { element, html } from '@plaited/island'

export const valueDisplay = element({
  tag: 'value-display',
  template: html`<h1 data-target="display" class="display" data-trigger="click->test">00:00</h1>`,
})
