import { type PlaitedElement, type Position, bElement, useTemplate, type FT } from 'plaited'
import type { StoryObj } from 'plaited/workshop'
import * as css from 'plaited/css'

const styles = css.create({
  root: {
    textDecorationLine: 'line-through',
  },
})

let did = 1
const adjectives = [
    'pretty',
    'large',
    'big',
    'small',
    'tall',
    'short',
    'long',
    'handsome',
    'plain',
    'quaint',
    'clean',
    'elegant',
    'easy',
    'angry',
    'crazy',
    'helpful',
    'mushy',
    'odd',
    'unsightly',
    'adorable',
    'important',
    'inexpensive',
    'cheap',
    'expensive',
    'fancy',
  ],
  colours = ['red', 'yellow', 'blue', 'green', 'pink', 'brown', 'purple', 'brown', 'white', 'black', 'orange'],
  nouns = [
    'table',
    'chair',
    'house',
    'bbq',
    'desk',
    'car',
    'pony',
    'cookie',
    'sandwich',
    'burger',
    'pizza',
    'mouse',
    'keyboard',
  ]

const random = (max: number) => Math.round(Math.random() * 1000) % max

type DataItem = { id: number; label: string }
type Data = DataItem[]

const buildData = (count: number): Data => {
  const data = []
  for (let i = 0; i < count; i++) {
    data.push({
      id: did++,
      label: `${adjectives[random(adjectives.length)]} ${colours[random(colours.length)]} ${
        nouns[random(nouns.length)]
      }`,
    })
  }
  return data
}

const Root: FT = (attrs) => (
  <div
    p-target='root'
    {...attrs}
  >
    <table p-target='table'></table>
    <template p-target='row-template'>
      <tr p-target='row'>
        <td
          class='col-md-1'
          p-target='id'
        ></td>
        <td class='col-md-4'>
          <a p-target='label'></a>
        </td>
        <td class='col-md-1'>
          <a>
            <span
              class='glyphicon glyphicon-remove'
              aria-hidden='true'
              p-target='delete'
            ></span>
          </a>
        </td>
        <td class='col-md-6'></td>
      </tr>
    </template>
  </div>
)

const Fixture = bElement({
  shadowDom: <Root />,
  tag: 'table-fixture',
  publicEvents: [
    'insert',
    'render',
    'replace',
    'remove',
    'removeAttributes',
    'getAttribute',
    'multiSetAttributes',
    'setStyle',
    'setAttribute',
  ],
  bProgram({ $ }) {
    const [template] = $<HTMLTemplateElement>('row-template')
    const cb = useTemplate<DataItem>(template, ($, data) => {
      $('row')[0].attr('p-target', data.id)
      $('id')[0].render(data.id)
      $('label')[0].render(data.label)
    })
    return {
      replace() {
        $('table')[0].replace(<span>I'm just a span</span>)
      },
      render() {
        $('table')[0].render(...buildData(100).map(cb))
      },
      insert(position: Position) {
        $('table')[0].insert(position, ...buildData(100).map(cb))
      },
      remove() {
        $('table')[0].replaceChildren()
      },
      getAttribute() {
        const attr = $('root')[0].attr('p-target')
        $('root')[0].render(<>{attr}</>)
      },
      removeAttributes() {
        const labels = $('label')
        labels.forEach((label) => label.attr('p-target', null))
      },
      setAttribute() {
        const [root] = $('root')
        root.attr('aria-label', 'helper fixture')
      },
      setStyle() {
        const [root] = $('root')
        root.replace(<Root {...styles.root} />)
      },
      multiSetAttributes() {
        const dels = $('delete')
        dels.forEach((del) =>
          del.attr({
            'p-target': 'cancel',
            'aria-hidden': 'false',
            class: null,
          }),
        )
      },
    }
  },
})

export const beforebegin: StoryObj = {
  description: `This story is used to validate that insert
  helper on the plaited element's QuerySelector, $. When passed the beforebegin as the first argument, it
  inserts content passed as the subsequent arguments before target element.`,
  template: Fixture,
  play: async ({ findByAttribute, assert }) => {
    const fixture = document.querySelector(Fixture.tag) as PlaitedElement
    let root = await findByAttribute<HTMLDivElement>('p-target', 'root')
    assert({
      given: 'before calling trigger',
      should: 'root child count should be 100',
      actual: root?.childElementCount,
      expected: 2,
    })
    fixture.trigger({ type: 'insert', detail: 'beforebegin' })
    root = await findByAttribute<HTMLDivElement>('p-target', 'root')
    assert({
      given: 'after calling trigger',
      should: 'root child count should be 101',
      actual: root?.childElementCount,
      expected: 102,
    })
    const table = await findByAttribute<HTMLTableElement>('p-target', 'table')
    assert({
      given: 'after calling trigger',
      should: 'root last child should be the table',
      actual: root?.lastChild,
      expected: table,
    })
  },
}
export const afterbegin: StoryObj = {
  description: `This story is used to validate that insert
  helper on the plaited element's QuerySelector, $. When passed the afterbegin as the first argument, it
  prepends content passed as the subsequent arguments to the target element.`,
  template: Fixture,
  play: async ({ findByAttribute, assert }) => {
    const fixture = document.querySelector(Fixture.tag) as PlaitedElement
    const table = await findByAttribute<HTMLTableElement>('p-target', 'table')
    assert({
      given: 'before calling trigger',
      should: 'table children should be empty',
      actual: table?.childElementCount,
      expected: 0,
    })
    fixture.trigger({ type: 'insert', detail: 'afterbegin' })
    assert({
      given: 'before calling trigger',
      should: 'table children should be 100',
      actual: table?.childElementCount,
      expected: 100,
    })
    const lastChild = table?.lastChild
    fixture.trigger({ type: 'insert', detail: 'afterbegin' })
    // @ts-expect-error: allow it to error
    const nodeList = Array.from(table.childNodes)
    assert({
      given: 'after calling trigger again',
      should: 'table children should be 200',
      actual: nodeList.length,
      expected: 200,
    })
    assert({
      given: 'after calling trigger again',
      should: 'original last child should be 200th',
      // @ts-expect-error: allow it to error
      actual: nodeList.indexOf(lastChild),
      expected: 199,
    })
  },
}
export const beforeend: StoryObj = {
  description: `This story is used to validate that insert
  helper on the plaited element's QuerySelector, $. When passed the beforeend as the first argument, it
  appends content passed as the subsequent arguments to the target element.`,
  template: Fixture,
  play: async ({ assert, findByAttribute }) => {
    const fixture = document.querySelector(Fixture.tag) as PlaitedElement
    const table = await findByAttribute<HTMLTableElement>('p-target', 'table')
    assert({
      given: 'before calling trigger',
      should: 'table children should be empty',
      actual: table?.childElementCount,
      expected: 0,
    })
    fixture.trigger({ type: 'insert', detail: 'beforeend' })
    assert({
      given: 'before calling trigger',
      should: 'table children should be 100',
      actual: table?.childElementCount,
      expected: 100,
    })
    const lastChild = table?.lastChild
    fixture.trigger({ type: 'insert', detail: 'beforeend' })
    // @ts-expect-error: allow it to error
    const nodeList = Array.from(table.childNodes)
    assert({
      given: 'after calling trigger again',
      should: 'table children should be 200',
      actual: nodeList.length,
      expected: 200,
    })
    assert({
      given: 'after calling trigger again',
      should: 'the original last child should be the 100th child',
      // @ts-expect-error: allow it to error
      actual: nodeList.indexOf(lastChild),
      expected: 99,
    })
  },
}
export const afterend: StoryObj = {
  description: `This story is used to validate that insert
  helper on the plaited element's QuerySelector, $. When passed the afterend as the first argument, it
  inserts content passed as the subsequent arguments after the target element.`,
  template: Fixture,
  play: async ({ assert, findByAttribute }) => {
    const fixture = document.querySelector(Fixture.tag) as PlaitedElement
    let root = await findByAttribute<HTMLDivElement>('p-target', 'root')
    assert({
      given: 'before calling trigger',
      should: 'root child count should be 2',
      actual: root?.childElementCount,
      expected: 2,
    })
    fixture.trigger({ type: 'insert', detail: 'afterend' })
    root = await findByAttribute<HTMLDivElement>('p-target', 'root')
    assert({
      given: 'after calling trigger',
      should: 'root child count should be 101',
      actual: root?.childElementCount,
      expected: 102,
    })
    const table = await findByAttribute<HTMLTableElement>('p-target', 'table')
    assert({
      given: 'after calling trigger',
      should: 'root first childe should be the table',
      actual: root?.firstChild,
      expected: table,
    })
  },
}
export const render: StoryObj = {
  description: `This story is used to validate that render helper on
  the plaited element's QuerySelector, $. When invoked it replaces all the children
  of the target element with the content passed to it as arguments.`,
  template: Fixture,
  play: async ({ findByAttribute, assert }) => {
    const fixture = document.querySelector(Fixture.tag) as PlaitedElement
    const table = await findByAttribute<HTMLTableElement>('p-target', 'table')
    assert({
      given: 'before calling trigger',
      should: 'table children should be empty',
      actual: table?.childElementCount,
      expected: 0,
    })
    fixture.trigger({ type: 'render' })
    assert({
      given: 'before calling trigger',
      should: 'table children should be 100',
      actual: table?.childElementCount,
      expected: 100,
    })
  },
}
export const replace: StoryObj = {
  description: `This story is used to validate that replace
  helper on the plaited element's QuerySelector, $. When invoked it replaces the
  target element with content passed to it as arguments.`,
  template: Fixture,
  play: async ({ assert, findByAttribute }) => {
    const fixture = document.querySelector(Fixture.tag) as PlaitedElement
    const root = await findByAttribute<HTMLDivElement>('p-target', 'root')
    assert({
      given: 'before calling trigger',
      should: 'root first child should be a table',
      actual: root?.firstChild instanceof HTMLTableElement,
      expected: true,
    })
    fixture.trigger({ type: 'replace' })
    assert({
      given: 'before calling trigger',
      should: 'root first childe children should be a span',
      actual: root?.firstChild instanceof HTMLSpanElement,
      expected: true,
    })
  },
}
export const getAttribute: StoryObj = {
  description: `This story is used to validate that attr
  helper on the plaited element's QuerySelector, $. When invoked with only a attribute name it returns
  the attribute value if it the attribute exist on the target element.`,
  template: Fixture,
  play: async ({ assert, findByAttribute }) => {
    const fixture = document.querySelector(Fixture.tag) as PlaitedElement
    const root = await findByAttribute<HTMLDivElement>('p-target', 'root')
    assert({
      given: 'before calling trigger',
      should: 'root firstChild should be a table',
      actual: root?.firstChild instanceof HTMLTableElement,
      expected: true,
    })
    fixture.trigger({ type: 'getAttribute' })
    assert({
      given: 'after calling trigger',
      should: 'root firstChild should be text',
      actual: root?.firstChild instanceof Text,
      expected: true,
    })
  },
}
export const setAttribute: StoryObj = {
  description: `This story is used to validate that attr
  helper on the plaited element's QuerySelector, $. When invoked with an attribute name and a value, it sets the attribute on the target element.`,
  template: Fixture,
  play: async ({ assert, findByAttribute }) => {
    const fixture = document.querySelector(Fixture.tag) as PlaitedElement
    const root = await findByAttribute<HTMLDivElement>('p-target', 'root')
    assert({
      given: 'before calling trigger',
      should: 'root does not have aria-label',
      actual: root?.hasAttribute('aria-label'),
      expected: false,
    })
    fixture.trigger({ type: 'setAttribute' })
    assert({
      given: 'after calling trigger',
      should: 'root aria-label is helper fixture',
      actual: root?.getAttribute('aria-label'),
      expected: 'helper fixture',
    })
  },
}
export const setStyle: StoryObj = {
  description: `This story is used to validate that attr
  helper on the plaited element's QuerySelector, $. When invoked with an attribute name and a value, it sets the attribute on the target element.`,
  template: Fixture,
  play: async ({ assert, findByAttribute }) => {
    const fixture = document.querySelector(Fixture.tag) as PlaitedElement
    let root = await findByAttribute<HTMLDivElement>('p-target', 'root')
    assert({
      given: 'before calling trigger',
      should: 'root does not have class attribute',
      actual: root?.hasAttribute('class'),
      expected: false,
    })
    fixture.trigger({ type: 'setStyle' })
    root = await findByAttribute<HTMLDivElement>('p-target', 'root')
    assert({
      given: 'after calling trigger',
      should: 'root classList of length 2',
      actual: root?.classList.length,
      expected: 2,
    })
    assert({
      given: 'after calling trigger',
      should: 'root  has computed style textDecorationLine of line-through',
      actual: getComputedStyle(root as Element).textDecorationLine,
      expected: 'line-through',
    })
  },
}
export const removeAttributes: StoryObj = {
  description: `This story is used to validate that attr
  helper on the plaited element's QuerySelector, $. When invoked with the attribute name and null
  it removes the the attribute from the element.`,
  template: Fixture,
  play: async ({ assert, findByAttribute }) => {
    const fixture = document.querySelector(Fixture.tag) as PlaitedElement
    fixture.trigger({ type: 'render' })
    let label = await findByAttribute<HTMLDivElement>('p-target', 'label')
    assert({
      given: 'before calling removeAttributes trigger',
      should: 'first found label should be an anchorElement',
      actual: label instanceof HTMLAnchorElement,
      expected: true,
    })
    fixture.trigger({ type: 'removeAttributes' })
    label = await findByAttribute<HTMLDivElement>('p-target', 'label')
    assert({
      given: 'after calling removeAttributes trigger',
      should: 'should not be able to find an element with p-target label',
      actual: label,
      expected: undefined,
    })
  },
}

export const multiSetAttributes: StoryObj = {
  description: `This story is used to validate that attr
  helper on the plaited element's QuerySelector, $. When invoked with an object of key value pairs
  it resets or adds the attributes to the element if the value is not null for a given key. If the value is
  null it deletes the attribute from the element.`,
  template: Fixture,
  play: async ({ assert, findByAttribute }) => {
    const fixture = document.querySelector(Fixture.tag) as PlaitedElement
    fixture.trigger({ type: 'render' })
    let el = await findByAttribute<HTMLDivElement>('p-target', 'delete')
    const can = await findByAttribute<HTMLSpanElement>('p-target', 'cancel')
    assert({
      given: 'before calling multiSetAttributes trigger',
      should: 'first found p-target delete element should be an span',
      actual: el instanceof HTMLSpanElement,
      expected: true,
    })
    assert({
      given: 'before calling multiSetAttributes trigger',
      should: 'el should have class',
      actual: el?.getAttribute('class'),
      expected: 'glyphicon glyphicon-remove',
    })
    assert({
      given: 'before calling multiSetAttributes trigger',
      should: 'aria-hidden should be true',
      actual: el?.getAttribute('aria-hidden'),
      expected: 'true',
    })
    assert({
      given: 'before calling multiSetAttributes trigger',
      should: 'should not be able to find an element with p-target cancel',
      actual: can,
      expected: undefined,
    })
    fixture.trigger({ type: 'multiSetAttributes' })
    el = await findByAttribute<HTMLDivElement>('p-target', 'delete')
    assert({
      given: 'after calling removeAttributes trigger',
      should: 'should not be able to find an element with p-target delete',
      actual: el,
      expected: undefined,
    })
    el = await findByAttribute<HTMLDivElement>('p-target', 'cancel')
    assert({
      given: 'after calling removeAttributes trigger',
      should: 'should find an element with p-target cancel',
      actual: el instanceof HTMLSpanElement,
      expected: true,
    })
    assert({
      given: 'after calling removeAttributes trigger',
      should: 'aria-hidden should be false',
      actual: el?.getAttribute('aria-hidden'),
      expected: 'false',
    })
    assert({
      given: 'after calling removeAttributes trigger',
      should: 'el should not have class attribute',
      actual: el?.getAttribute('class'),
      expected: null,
    })
  },
}
