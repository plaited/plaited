import { html, insertIsland, IslandTemplate } from '$plaited'
import { ops } from './constants.ts'
import { classes } from './calculator.styles.ts'

export const CalculatorTemplate = IslandTemplate({
  tag: 'calculator-island',
  template: html`<div class="${classes.calculator}">
    <!-- display -->
    <div class="${classes.display}">
      <h1 data-target="previous" class="${classes.header}"></h1>
      <h1 data-target="current" class="${classes.header}">0</h1>
    </div>
    <!-- Row one -->
    <button class="${classes.top}" data-trigger="click->positive-negative">${ops.add}/${ops.minus}</button>
    <button class="${classes.top}" data-trigger="click->squareRoot" value="squareRoot">${ops.squareRoot}</button>
    <button class="${classes.top}" data-trigger="click->percent" value="percent">${ops.percent}</button>
    <button class="${classes.side}" data-trigger="click->calculate" value="divide">${ops.divide}</button>
    <!-- Row two -->
    <button class="${classes.number}" data-trigger="click->number" value="7">7</button>
    <button class="${classes.number}" data-trigger="click->number" value="8">8</button>
    <button class="${classes.number}" data-trigger="click->number" value="9">9</button>
    <button class="${classes.side}" data-trigger="click->calculate" value="multiply">${ops.multiply}</button>
    <!-- Row three -->
    <button class="${classes.number}" data-trigger="click->number" value="4">4</button>
    <button class="${classes.number}" data-trigger="click->number" value="5">5</button>
    <button class="${classes.number}" data-trigger="click->number" value="6">6</button>
    <button class="${classes.side}" data-trigger="click->calculate" value="minus">${ops.minus}</button>

    <!-- Row four -->
    <button class="${classes.number}" data-trigger="click->number" value="1">1</button>
    <button class="${classes.number}" data-trigger="click->number" value="2">2</button>
    <button class="${classes.number}" data-trigger="click->number" value="3">3</button>
    <button class="${classes.side}" data-trigger="click->calculate" value="add">${ops.add}</button>

    <!-- Row five -->
    <button class="${classes.clear}" data-trigger="click->clear">AC</button>
    <button class="${classes.number}" data-trigger="click->number" value="0">0</button>
    <button class="${classes.number}" data-trigger="click->period">.</button>
    <button class="${classes.side}" data-trigger="click->equal" value="equal">${ops.equal}</button>
  </div>`,
})

const body = document.querySelector('body') as HTMLBodyElement

insertIsland({ el: body, island: CalculatorTemplate, position: 'afterbegin' })
