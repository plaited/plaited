import { symbols } from '../constants.ts'
import { test } from '../test.ts'

test('island worker comms test', async (t) => {
  const island = await t.findByAttribute('data-target', 'calculator')
  t({
    given: `island SSR'd with default delegateFocus`,
    should: 'delegate focus',
    actual: island?.shadowRoot?.delegatesFocus,
    expected: true,
  })
  // should be an example of a ui and also test worker connection
  let button = await t.findByAttribute('value', '9')
  button && await t.fireEvent(button, 'click')
  button = await t.findByAttribute('value', 'multiply')
  button && await t.fireEvent(button, 'click')
  let target = await t.findByText(`9 ${symbols.multiply}`)
  t({
    given: 'clicking 9 then multiply',
    should: 'render number and operation in previous target',
    actual: target?.dataset.target,
    expected: `previous`,
  })
  button = await t.findByAttribute('value', '1')
  button && await t.fireEvent(button, 'click')
  button = await t.findByAttribute('value', '0')
  button && await t.fireEvent(button, 'click')
  button = await t.findByAttribute('value', 'percent')
  button && await t.fireEvent(button, 'click')
  target = await t.findByText(`0.9`)

  t({
    given: 'clicking 1, 0, then percent',
    should: 'render 10 percent of previous value as current target',
    actual: target?.dataset.target,
    expected: `current`,
  })
  button = await t.findByAttribute('value', 'equal')
  button && await t.fireEvent(button, 'click')
  target = await t.findByText(`9 ${symbols.multiply}  0.9 ${symbols.equal}`)
  t({
    given: 'clicking =',
    should: 'display calculation carried out',
    actual: target?.dataset.target,
    expected: `previous`,
  })
  button = await t.findByAttribute('data-trigger', /click->clear/)
  button && await t.fireEvent(button, 'click')
  let header = await t.findByAttribute('data-target', 'previous')
  t({
    given: 'clicking AC',
    should: 'clear previous header',
    actual: header?.innerHTML,
    expected: ``,
  })
  header = await t.findByAttribute('data-target', 'current')
  t({
    given: 'clicking AC',
    should: '0 current value',
    actual: header?.innerHTML,
    expected: `0`,
  })
  button = await t.findByAttribute('value', '7')
  button && await t.fireEvent(button, 'click')
  button = await t.findByAttribute('value', '3')
  button && await t.fireEvent(button, 'click')
  button = await t.findByAttribute('value', 'subtract')
  button && await t.fireEvent(button, 'click')
  button = await t.findByAttribute('value', '7')
  button && await t.fireEvent(button, 'click')
  button = await t.findByAttribute('value', '0')
  button && await t.fireEvent(button, 'click')
  button = await t.findByAttribute('value', 'add')
  button && await t.fireEvent(button, 'click')
  target = await t.findByText(`3 ${symbols.add}`)
  t({
    given: '73 - 70',
    should: 'display 3 in previous header',
    actual: target?.dataset.target,
    expected: `previous`,
  })
  button = await t.findByAttribute('value', '6')
  button && await t.fireEvent(button, 'click')
  button = await t.findByAttribute('value', 'equal')
  button && await t.fireEvent(button, 'click')
  button = await t.findByAttribute('value', 'squareRoot')
  button && await t.fireEvent(button, 'click')
  header = await t.findByAttribute('data-target', 'current')
  t({
    given: 'add 6 then click square root',
    should: 'display 3 in current header',
    actual: header?.innerHTML,
    expected: `3`,
  })
})
