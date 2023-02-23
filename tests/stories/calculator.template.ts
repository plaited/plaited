import { html, IslandTemplate, template } from '$plaited'

const valueDisplay = IslandTemplate({
  tag: 'value-display',
  stylesheets: `h1 { color: purple; }`,
  template:
    html`<h1 data-target="display" class="display" data-trigger="click->test">00:00</h1>`,
})

const keyPad = IslandTemplate({
  tag: 'key-pad',
  template: html`<div class="keypad">
    <div>
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
  </div>`,
})

export const CalculatorTemplate = template(() => html`${valueDisplay}${keyPad}`)
