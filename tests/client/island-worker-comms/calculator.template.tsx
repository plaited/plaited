import { symbols } from '../constants.ts'
import { classes, styles } from './calculator.styles.ts'
import { CalculatorIsland } from './calculator.island.ts'

export const CalculatorTemplate = () => (
  <CalculatorIsland.template styles={styles} target='calculator'>
    <div className={classes.calculator}>
      {/* <!-- display --> */}
      <div className={classes.display}>
        <h1 data-target='previous' className={classes.header}></h1>
        <h1 data-target='current' className={classes.header}>0</h1>
      </div>
      {/* <!-- Row one --> */}
      <button className={classes.top} data-trigger='click->positive-negative'>
        ${symbols.add}/${symbols.subtract}
      </button>
      <button
        className={classes.top}
        data-trigger='click->squareRoot'
        value='squareRoot'
      >
        ${symbols.squareRoot}
      </button>
      <button
        className={classes.top}
        data-trigger='click->percent'
        value='percent'
      >
        ${symbols.percent}
      </button>
      <button
        className={classes.side}
        data-trigger='click->divide'
        value='divide'
      >
        ${symbols.divide}
      </button>
      {/* <!-- Row two --> */}
      <button className={classes.number} data-trigger='click->number' value='7'>
        7
      </button>
      <button className={classes.number} data-trigger='click->number' value='8'>
        8
      </button>
      <button className={classes.number} data-trigger='click->number' value='9'>
        9
      </button>
      <button
        className={classes.side}
        data-trigger='click->multiply'
        value='multiply'
      >
        ${symbols.multiply}
      </button>
      {/* <!-- Row three --> */}
      <button className={classes.number} data-trigger='click->number' value='4'>
        4
      </button>
      <button className={classes.number} data-trigger='click->number' value='5'>
        5
      </button>
      <button className={classes.number} data-trigger='click->number' value='6'>
        6
      </button>
      <button
        className={classes.side}
        data-trigger='click->subtract'
        value='subtract'
      >
        ${symbols.subtract}
      </button>

      {/* <!-- Row four --> */}
      <button className={classes.number} data-trigger='click->number' value='1'>
        1
      </button>
      <button className={classes.number} data-trigger='click->number' value='2'>
        2
      </button>
      <button className={classes.number} data-trigger='click->number' value='3'>
        3
      </button>
      <button className={classes.side} data-trigger='click->add' value='add'>
        ${symbols.add}
      </button>

      {/* <!-- Row five --> */}
      <button className={classes.clear} data-trigger='click->clear'>AC</button>
      <button className={classes.number} data-trigger='click->number' value='0'>
        0
      </button>
      <button className={classes.number} data-trigger='click->period'>.</button>
      <button
        className={classes.side}
        data-trigger='click->equal'
        value='equal'
      >
        ${symbols.equal}
      </button>
    </div>
  </CalculatorIsland.template>
)
