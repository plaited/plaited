import { element, html } from '@plaited/template'

export const keyPad = element({
  tag: 'key-pad',
  template: html`<number-pad id="number-pad">
  <template shadowroot="open">
    <div class="keypad">
      <div class="number-grid">
        <button class="number-button" data-trigger="click->number" value="1">1</button>
        <button class="number-button" data-trigger="click->number" value="2">2</button>
        <button class="number-button" data-trigger="click->number" value="3">3</button>
        <button class="number-button" data-trigger="click->number" value="4">4</button>
        <button class="number-button" data-trigger="click->number" value="5">5</button>
        <button class="number-button" data-trigger="click->number" value="6">6</button>
        <button class="number-button" data-trigger="click->number" value="7">7</button>
        <button class="number-button" data-trigger="click->number" value="8">8</button>
        <button class="number-button" data-trigger="click->number" value="9">9</button>
        <button class="number-button" data-trigger="click->number" value="0">0</button>
      </div>
      <button class="clear-button" data-trigger="click->clear">Clear</button>
    </div>
  </template>
</number-pad>`,
})
