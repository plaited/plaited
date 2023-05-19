import {  useSugar } from 'plaited'
import { Calculator, CalculatorTemplate } from './calculator.js'
const root = useSugar(document.querySelector('#root'))
Calculator()
root.render(<CalculatorTemplate />)
