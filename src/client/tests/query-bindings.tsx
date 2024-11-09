import type { Position, CloneCallback } from '../get-query-helper.js'
import { defineTemplate } from '../define-template.js'

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

const row = (
  <tr p-target='row'>
    <td
      className='col-md-1'
      p-target='id'
    ></td>
    <td className='col-md-4'>
      <a p-target='label'></a>
    </td>
    <td className='col-md-1'>
      <a>
        <span
          className='glyphicon glyphicon-remove'
          aria-hidden='true'
          p-target='delete'
        ></span>
      </a>
    </td>
    <td className='col-md-6'></td>
  </tr>
)

const forEachRow: CloneCallback<DataItem> = ($, data) => {
  $('row')[0].attr('p-target', `${data.id}`)
  $('id')[0].render(<>{data.id}</>)
  $('label')[0].render(<>{data.label}</>)
}

export const Fixture = defineTemplate({
  shadowDom: (
    <div p-target='root'>
      <table p-target='table'></table>
    </div>
  ),
  tag: 'table-fixture',
  publicEvents: ['insert', 'render', 'replace', 'remove', 'removeAttributes', 'getAttribute', 'multiSetAttributes'],
  bProgram({ $ }) {
    const cb = $.clone(row, forEachRow)
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
