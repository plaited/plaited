/**
 * Demonstrates Plaited's DOM querying and manipulation capabilities through the $ selector
 * and element bindings. Shows how to efficiently manage large datasets with templating
 * and dynamic updates.
 *
 * Features:
 * - Template-based rendering
 * - Attribute manipulation
 * - DOM manipulation methods
 * - Position-based insertion
 * - Batch operations
 *
 * @example
 * ```tsx
 * const ListComponent = defineElement({
 *   tag: 'list-component',
 *   shadowDom: (
 *     <div p-target="container">
 *       <template p-target="item-template">
 *         <li p-target="item">
 *           <span p-target="label" />
 *           <button p-target="delete" />
 *         </li>
 *       </template>
 *       <ul p-target="list" />
 *     </div>
 *   ),
 *   bProgram({ $ }) {
 *     const [template] = $<HTMLTemplateElement>('item-template');
 *     const createItem = useTemplate(template, ($, item) => {
 *       $('item')[0].attr('data-id', item.id);
 *       $('label')[0].render(item.label);
 *       $('delete')[0].render('Delete');
 *     });
 *
 *     return {
 *       // Insert items at start of list
 *       prependItems(items) {
 *         $('list')[0].insert('afterbegin', ...items.map(createItem));
 *       },
 *
 *       // Replace all items
 *       setItems(items) {
 *         $('list')[0].render(...items.map(createItem));
 *       },
 *
 *       // Update item attributes
 *       updateItem(id, attrs) {
 *         $('item', { mod: '*=', all: true }).forEach(item => {
 *           if (item.getAttribute('data-id') === id) {
 *             item.attr(attrs);
 *           }
 *         });
 *       }
 *     };
 *   }
 * });
 * ```
 */

import { type Position, defineElement, useTemplate } from 'plaited'

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

export const Fixture = defineElement({
  shadowDom: (
    <div p-target='root'>
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
  ),
  tag: 'table-fixture',
  publicEvents: ['insert', 'render', 'replace', 'remove', 'removeAttributes', 'getAttribute', 'multiSetAttributes'],
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
