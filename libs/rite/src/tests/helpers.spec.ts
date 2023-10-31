import { test } from '../index.js'
import { findByAttribute } from '../find-by-attribute.js'
import { findByText } from '../find-by-text.js'
import { fireEvent } from '../fire-event.js'

test('findByAttribute: light dom', async (t) => {
  // Create two element to be used to validate helper
  const firstEl = document.createElement('div')
  const secondEl = document.createElement('div')
  // Set text content on elements
  firstEl.textContent = 'I am the first div'
  const expected = 'I am the second div'
  secondEl.textContent = expected

  // Set attributes on elements
  firstEl.setAttribute('data-test', 'first')
  secondEl.setAttribute('data-test', 'second')
  //Append elements to body
  document.body.append(firstEl, secondEl)
  // Search for secondEl
  const second = await findByAttribute('data-test', 'second')
  t({
    given: 'search for element with attribute',
    should: 'find child element',
    actual: second?.textContent,
    expected,
  })
  // Cleanup
  firstEl.remove()
  secondEl.remove()
})

test('findByAttribute: shadow dom', async (t) => {
  // Create context and host for shadow root
  const context = document.createElement('div')

  // Attach a Shadow DOM to context
  const shadowRoot = context.attachShadow({ mode: 'open' })

  // Create element to append to shadow context
  const el = document.createElement('p')
  const expected = 'shadow child element!'
  el.textContent = expected
  el.setAttribute('data-test', 'shadow-child')

  // Append element to shadowRoot
  shadowRoot.append(el)

  // Append context to body
  document.body.append(context)

  // Search without passing context option
  let target = await findByAttribute('data-test', 'shadow-child')
  t({
    given: 'search without passing context',
    should: 'find child element',
    actual: target?.textContent,
    expected,
  })
  // Search with passing context
  target = await findByAttribute('data-test', 'shadow-child', context)
  t({
    given: 'a search with host context',
    should: 'find child element',
    actual: target?.textContent,
    expected,
  })
  context.remove()
})

test('findByAttribute: nested shadow dom', async (t) => {
  // Create context
  const context = document.createElement('div')

  // Attach a Shadow DOM to  context
  const outerShadowRoot = context.attachShadow({ mode: 'open' })

  // Create the inner host
  const innerHost = document.createElement('p')

  // Attach a Shadow DOM to inner host element
  const innerShadowRoot = innerHost.attachShadow({ mode: 'open' })

  // Add some content to the innerHost shadowRoot
  const innerContent = document.createElement('span')
  const expected = 'Hello from the inner shadow DOM!'
  innerContent.textContent = expected
  innerContent.setAttribute('data-test', 'nested-shadow-element')
  innerShadowRoot.appendChild(innerContent)

  // Add the inner element to the outer Shadow DOM
  outerShadowRoot.appendChild(innerHost)

  // Add the outer element to the document body
  document.body.appendChild(context)

  let el = await findByAttribute('data-test', 'nested-shadow-element')
  t({
    given: 'search for child without context',
    should: 'find child element',
    actual: el?.textContent,
    expected,
  })
  el = await findByAttribute('data-test', 'nested-shadow-element')

  t({
    given: 'search for child with context',
    should: 'find child element',
    actual: el?.textContent,
    expected,
  })

  context.remove()
})

test('findByAttribute: first element that satisfies query', async (t) => {
  const textContent = 'Hello from the inner shadow DOM!'
  // Create context
  const context = document.createElement('div')

  // Attach a Shadow DOM to  context
  const outerShadowRoot = context.attachShadow({ mode: 'open' })
  // Create the inner host
  const innerHost = document.createElement('p')
  const outerContent = document.createElement('span')
  outerContent.textContent = textContent
  outerContent.setAttribute('data-test', 'shadow-child')
  outerShadowRoot.append(outerContent)

  // Attach a Shadow DOM to inner host element
  const innerShadowRoot = innerHost.attachShadow({ mode: 'open' })

  // Add some content to the innerHost shadowRoot
  const innerContent = document.createElement('span')

  innerContent.textContent = textContent
  innerContent.setAttribute('data-test', 'shadow-child')
  innerShadowRoot.appendChild(innerContent)

  // Add the inner element to the outer Shadow DOM
  outerShadowRoot.appendChild(innerHost)

  // Add the outer element to the document body
  document.body.appendChild(context)

  const el = await findByAttribute('data-test', 'shadow-child')
  t({
    given: 'search for child without context',
    should: 'find child element',
    actual: el?.getRootNode(),
    expected: outerShadowRoot,
  })
  context.remove()
})

test('findByText: light dom', async (t) => {
  // Create two element to be used to validate helper
  const firstEl = document.createElement('div')
  const secondEl = document.createElement('div')
  // Set text content on elements
  firstEl.textContent = 'I am the first div'
  const textContent = 'I am the second div'
  secondEl.textContent = textContent

  //Append elements to body
  document.body.append(firstEl, secondEl)
  // Search for secondEl
  const second = await findByText(textContent)
  t({
    given: 'search for element with attribute',
    should: 'find child element',
    actual: second,
    expected: secondEl,
  })
  // Cleanup
  firstEl.remove()
  secondEl.remove()
})

test('findByText: shadow dom', async (t) => {
  // Create context and host for shadow root
  const context = document.createElement('div')

  // Attach a Shadow DOM to context
  const shadowRoot = context.attachShadow({ mode: 'open' })

  // Create element to append to shadow context
  const el = document.createElement('p')
  const textContent = 'shadow child element!'
  el.textContent = textContent

  // Append element to shadowRoot
  shadowRoot.append(el)

  // Append context to body
  document.body.append(context)

  // Search without passing context option
  let target = await findByText(textContent)
  t({
    given: 'search without passing context',
    should: 'find child element',
    actual: target,
    expected: el,
  })
  // Search with passing context
  target = await findByText(textContent, context)
  t({
    given: 'a search with host context',
    should: 'find child element',
    actual: target,
    expected: el,
  })
  context.remove()
})

test('findByText: nested shadow dom', async (t) => {
  // Create context
  const context = document.createElement('div')

  // Attach a Shadow DOM to  context
  const outerShadowRoot = context.attachShadow({ mode: 'open' })

  // Create the inner host
  const innerHost = document.createElement('p')

  // Attach a Shadow DOM to inner host element
  const innerShadowRoot = innerHost.attachShadow({ mode: 'open' })

  // Add some content to the innerHost shadowRoot
  const innerContent = document.createElement('span')
  const textContent = 'Hello from the inner shadow DOM!'
  innerContent.textContent = textContent
  innerShadowRoot.appendChild(innerContent)

  // Add the inner element to the outer Shadow DOM
  outerShadowRoot.appendChild(innerHost)

  // Add the outer element to the document body
  document.body.appendChild(context)

  let el = await findByText(textContent)
  t({
    given: 'search for child without context',
    should: 'find child element',
    actual: el,
    expected: innerContent,
  })
  el = await findByText(textContent)

  t({
    given: 'search for child with context',
    should: 'find child element',
    actual: el,
    expected: innerContent,
  })

  context.remove()
})

test('findByText: first element that satisfies query', async (t) => {
  const textContent = 'Hello from the inner shadow DOM!'
  // Create context
  const context = document.createElement('div')

  // Attach a Shadow DOM to  context
  const outerShadowRoot = context.attachShadow({ mode: 'open' })
  // Create the inner host
  const innerHost = document.createElement('p')
  const outerContent = document.createElement('span')
  outerContent.textContent = textContent
  outerShadowRoot.append(outerContent)

  // Attach a Shadow DOM to inner host element
  const innerShadowRoot = innerHost.attachShadow({ mode: 'open' })

  // Add some content to the innerHost shadowRoot
  const innerContent = document.createElement('span')

  innerContent.textContent = textContent
  innerShadowRoot.appendChild(innerContent)

  // Add the inner element to the outer Shadow DOM
  outerShadowRoot.appendChild(innerHost)

  // Add the outer element to the document body
  document.body.appendChild(context)

  const el = await findByText(textContent)
  t({
    given: 'search for child without context',
    should: 'find child element',
    actual: el?.getRootNode(),
    expected: outerShadowRoot,
  })
  context.remove()
})

test('fireEvent', async (t) => {
  // Create two element to be used to validate helper
  const target = document.createElement('div')
  const button = document.createElement('button')
  // text content to append
  const textContent = 'I am the div'

  // Set attributes on target
  target.setAttribute('data-test', 'target')
  // Attach event listener to button
  button.addEventListener('click', () => (target.textContent = textContent))

  //Append elements to body
  document.body.append(button, target)

  await fireEvent(button, 'click')
  const el = await findByAttribute('data-test', 'target')
  t({
    given: 'search for element with attribute',
    should: 'find child element',
    actual: el?.textContent,
    expected: textContent,
  })
  // Cleanup
  target.remove()
  button.remove()
})
