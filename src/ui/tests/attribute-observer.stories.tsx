import { story } from 'plaited/testing'

import { AttributeObserver } from './fixtures/attribute-observer.tsx'

export const attributeSync = story({
  intent: `Example of how to use useAttributesObserver to observe attributes changes and trigger
  events in a Behavioral elements. This story is used to validate that when a slotted element such as input
  has a change event `,
  template: () => (
    <AttributeObserver>
      <input type='checkbox' />
    </AttributeObserver>
  ),
  async play({ findByAttribute, findByTarget, assert }) {
    const checkbox = await findByAttribute<HTMLInputElement>('type', 'checkbox')
    checkbox?.toggleAttribute('disabled')
    let name = await findByAttribute<HTMLSpanElement>('p-target', 'name')
    let oldValue = await findByTarget<HTMLSpanElement>('oldValue')
    let newValue = await findByTarget<HTMLSpanElement>('newValue')
    assert({
      given: 'setting disabled on input',
      should: 'name should have text content',
      actual: name?.textContent,
      expected: 'disabled',
    })
    assert({
      given: 'setting disabled on input',
      should: 'oldValue should have text content',
      actual: oldValue?.textContent,
      expected: 'null',
    })
    assert({
      given: 'setting disabled on input',
      should: 'newValue should have text content',
      actual: newValue?.textContent,
      expected: '',
    })
    assert({
      given: 'toggling disabled attribute',
      should: 'have attribute name',
      actual: checkbox?.hasAttribute('disabled'),
      expected: true,
    })
    checkbox?.toggleAttribute('disabled')
    name = await findByTarget<HTMLSpanElement>('name')
    oldValue = await findByTarget<HTMLSpanElement>('oldValue')
    newValue = await findByTarget<HTMLSpanElement>('newValue')
    assert({
      given: 'setting disabled on input',
      should: 'name should have text content',
      actual: name?.textContent,
      expected: 'disabled',
    })
    assert({
      given: 'setting disabled on input',
      should: 'oldValue should have text content',
      actual: oldValue?.textContent,
      expected: '',
    })
    assert({
      given: 'setting disabled on input',
      should: 'newValue should have text content',
      actual: newValue?.textContent,
      expected: 'null',
    })
    checkbox?.setAttribute('value', 'hello world')
    name = await findByTarget<HTMLSpanElement>('name')
    oldValue = await findByTarget<HTMLSpanElement>('oldValue')
    newValue = await findByTarget<HTMLSpanElement>('newValue')
    assert({
      given: 'setting value on input',
      should: 'name should have text content',
      actual: name?.textContent,
      expected: 'value',
    })
    assert({
      given: 'setting value on input',
      should: 'oldValue should have text content',
      actual: oldValue?.textContent,
      expected: 'null',
    })
    assert({
      given: 'setting value on input',
      should: 'newValue should have text content',
      actual: newValue?.textContent,
      expected: 'hello world',
    })
  },
})
