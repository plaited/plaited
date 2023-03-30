import { html } from '$plaited'
import { symbols } from '../constants.ts'
import { classes, styles } from './calculator.styles.ts'
import { CalculatorIsland } from './calculator.island.ts'

export const CalculatorTemplate = CalculatorIsland.template({
  styles,
  target: 'calculator',
  shadow: html`<div class="${classes.calculator}">
    <!-- display -->
    <div class="${classes.display}">
      <h1 data-target="previous" class="${classes.header}"></h1>
      <h1 data-target="current" class="${classes.header}">0</h1>
    </div>
    <!-- Row one -->
    <button class="${classes.top}" data-trigger="click->positive-negative">${symbols.add}/${symbols.subtract}</button>
    <button class="${classes.top}" data-trigger="click->squareRoot" value="squareRoot">${symbols.squareRoot}</button>
    <button class="${classes.top}" data-trigger="click->percent" value="percent">${symbols.percent}</button>
    <button class="${classes.side}" data-trigger="click->divide" value="divide">${symbols.divide}</button>
    <!-- Row two -->
    <button class="${classes.number}" data-trigger="click->number" value="7">7</button>
    <button class="${classes.number}" data-trigger="click->number" value="8">8</button>
    <button class="${classes.number}" data-trigger="click->number" value="9">9</button>
    <button class="${classes.side}" data-trigger="click->multiply" value="multiply">${symbols.multiply}</button>
    <!-- Row three -->
    <button class="${classes.number}" data-trigger="click->number" value="4">4</button>
    <button class="${classes.number}" data-trigger="click->number" value="5">5</button>
    <button class="${classes.number}" data-trigger="click->number" value="6">6</button>
    <button class="${classes.side}" data-trigger="click->subtract" value="subtract">${symbols.subtract}</button>

    <!-- Row four -->
    <button class="${classes.number}" data-trigger="click->number" value="1">1</button>
    <button class="${classes.number}" data-trigger="click->number" value="2">2</button>
    <button class="${classes.number}" data-trigger="click->number" value="3">3</button>
    <button class="${classes.side}" data-trigger="click->add" value="add">${symbols.add}</button>

    <!-- Row five -->
    <button class="${classes.clear}" data-trigger="click->clear">AC</button>
    <button class="${classes.number}" data-trigger="click->number" value="0">0</button>
    <button class="${classes.number}" data-trigger="click->period">.</button>
    <button class="${classes.side}" data-trigger="click->equal" value="equal">${symbols.equal}</button>
  </div>`,
})