import { html, IslandTemplate } from '$plaited'
import { classes } from './calculator.styles.ts'

export const CalculatorTemplate = IslandTemplate({
  tag: 'calculator-interface',
  template: html`<div class="${classes.calculator}">
    <!-- dispplay -->
    <h1 data-target="${classes.display}" class="${classes.display}">0</h1>
    <!-- Row one -->
    <button class="${classes.top}" data-trigger="click->positive-negative">+/-</button>
    <button class="${classes.top}" data-trigger="click->square-root">√</button>
    <button class="${classes.top}" data-trigger="click->percent">%</button>
    <button class="${classes.side}" data-trigger="click->divide">÷</button>
    <!-- Row two -->
    <button class="${classes.number}" data-trigger="click->number" value="7">7</button>
    <button class="${classes.number}" data-trigger="click->number" value="8">8</button>
    <button class="${classes.number}" data-trigger="click->number" value="9">9</button>
    <button class="${classes.side}" data-trigger="click->multiply">×</button>
    <!-- Row three -->
    <button class="${classes.number}" data-trigger="click->number" value="4">4</button>
    <button class="${classes.number}" data-trigger="click->number" value="5">5</button>
    <button class="${classes.number}" data-trigger="click->number" value="6">6</button>
    <button class="${classes.side}" data-trigger="click->minus">–</button>

    <!-- Row four -->
    <button class="${classes.number}" data-trigger="click->number" value="1">1</button>
    <button class="${classes.number}" data-trigger="click->number" value="2">2</button>
    <button class="${classes.number}" data-trigger="click->number" value="3">3</button>
    <button class="${classes.side}" data-trigger="click->add">+</button>

    <!-- Row five -->
    <button class="${classes.clear}" data-trigger="click->clear">C</button>
    <button class="${classes.number}" data-trigger="click->number" value="0">0</button>
    <button class="${classes.number}" data-trigger="click->period">.</button>
    <button class="${classes.side}" data-trigger="click->equal">=</button>
  </div>`,
})
