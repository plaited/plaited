import { Calculator } from './calculator.js'
customElements.define(Calculator.tag, Calculator)
const calc = document.createElement(Calculator.tag)
const body = document.querySelector('body')
body.appendChild(calc)
