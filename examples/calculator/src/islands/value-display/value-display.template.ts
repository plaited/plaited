import { element, html } from '@plaited/template'

export const valueDisplay = element({
  tag: 'value-display',
  template: html`<value-display>
  <template shadowroot="open">
    <h1 data-target="display" class="display" data-trigger="click->test">00:00</h1>
  </template>
</value-display>`,
})
