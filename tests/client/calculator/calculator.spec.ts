import { symbols } from './constants.ts'
import { TestCallback } from '../type.ts'

export const islandCommsTest: TestCallback = async (t, context) => {
  const island = context.querySelector('calculator-island')
  island?.shadowRoot?.delegatesFocus
  t({
    given: `island SSR'd with default delegateFocus`,
    should: 'delegate focus',
    actual: island?.shadowRoot?.delegatesFocus,
    expected: true,
  })
  // should be an example of a ui and also test worker connection
  let button = await t.findByAttribute('value', '9', context)
  button && await t.fireEvent(button, 'click')
  button = await t.findByAttribute('value', 'multiply', context)
  button && await t.fireEvent(button, 'click')
  let target = await t.findByText(`9 ${symbols.multiply}`, context)
  t({
    given: 'clicking 9 then multiply',
    should: 'render number and operation in previous target',
    actual: target?.dataset.target,
    expected: `previous`,
  })
  button = await t.findByAttribute('value', '1', context)
  button && await t.fireEvent(button, 'click')
  button = await t.findByAttribute('value', '0', context)
  button && await t.fireEvent(button, 'click')
  button = await t.findByAttribute('value', 'percent', context)
  button && await t.fireEvent(button, 'click')
  target = await t.findByText(`0.9`, context)
  t({
    given: 'clicking 1, 0, then percent',
    should: 'render 10 percent of previous value as current target',
    actual: target?.dataset.target,
    expected: `current`,
  })
  button = await t.findByAttribute('value', 'equal', context)
  button && await t.fireEvent(button, 'click')
  target = await t.findByText(
    `9 ${symbols.multiply}  0.9 ${symbols.equal}`,
    context,
  )
  t({
    given: 'clicking =',
    should: 'display calculation carried out',
    actual: target?.dataset.target,
    expected: `previous`,
  })
  button = await t.findByAttribute('data-trigger', /click->clear/, context)
  button && await t.fireEvent(button, 'click')
  let header = await t.findByAttribute('data-target', 'previous', context)
  t({
    given: 'clicking AC',
    should: 'clear previous header',
    actual: header?.innerHTML,
    expected: ``,
  })
  header = await t.findByAttribute('data-target', 'current', context)
  t({
    given: 'clicking AC',
    should: '0 current value',
    actual: header?.innerHTML,
    expected: `0`,
  })
  button = await t.findByAttribute('value', '7', context)
  button && await t.fireEvent(button, 'click')
  button = await t.findByAttribute('value', '3', context)
  button && await t.fireEvent(button, 'click')
  button = await t.findByAttribute('value', 'subtract', context)
  button && await t.fireEvent(button, 'click')
  button = await t.findByAttribute('value', '7', context)
  button && await t.fireEvent(button, 'click')
  button = await t.findByAttribute('value', '0', context)
  button && await t.fireEvent(button, 'click')
  button = await t.findByAttribute('value', 'add', context)
  button && await t.fireEvent(button, 'click')
  target = await t.findByText(`3 ${symbols.add}`, context)
  t({
    given: '73 - 70',
    should: 'display 3 in previous header',
    actual: target?.dataset.target,
    expected: `previous`,
  })
  button = await t.findByAttribute('value', '6', context)
  button && await t.fireEvent(button, 'click')
  button = await t.findByAttribute('value', 'equal', context)
  button && await t.fireEvent(button, 'click')
  button = await t.findByAttribute('value', 'squareRoot', context)
  button && await t.fireEvent(button, 'click')
  header = await t.findByAttribute('data-target', 'current', context)
  t({
    given: 'add 6 then click square root',
    should: 'display 3 in current header',
    actual: header?.innerHTML,
    expected: `3`,
  })
}
