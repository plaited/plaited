import { html, isle, PlaitProps, render, template, useStore } from '$plaited'
import { logger } from '../logger.ts'
import { connect } from './comms.ts'

const TableBodyTemplate = template((
  { data }: { data: { id: number; label: string; selected: boolean }[] },
) =>
  html`    <tbody data-target="tbody">${
    data.map((item: { id: number; label: string; selected: boolean }) => {
      return html`
    <tr id=${item.id} class="${item.selected && 'danger'}">
      <td class="col-md-1">${item.id}</td>
      <td class="col-md-4">
        <a>${item.label}</a>
      </td>
      <td data-id="${item.id}" class="col-md-1" data-interaction='delete'>
        <a>
          <span class="glyphicon glyphicon-remove" aria-hidden="true"></span>
        </a>
      </td>
      <td class="col-md-6"></td>
    </tr>`
    })
  }</tbody>`
)

export const Benchmark = isle(
  { tag: 'benchmark-island', dev: logger, connect },
  (base) =>
    class extends base {
      plait({ feedback, addThreads, loop, sync, $, trigger }: PlaitProps) {
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
        ]
        const colours = [
          'red',
          'yellow',
          'blue',
          'green',
          'pink',
          'brown',
          'purple',
          'brown',
          'white',
          'black',
          'orange',
        ]
        const nouns = [
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
        const [getData, setData] = useStore<
          { id: number; label: string; selected: boolean }[]
        >([])
        const [getSelected, setSelected] = useStore(-1)
        const random = (max: number) => {
          return Math.round(Math.random() * 1000) % max
        }
        const buildData = (count: number) =>
          setData((data) => {
            let did = data.at(-1)?.id || 0
            for (let i = 0; i < count; i++) {
              data.push({
                id: did++,
                label: `${adjectives[random(adjectives.length)]} ${
                  colours[random(colours.length)]
                } ${nouns[random(nouns.length)]}`,
                selected: false,
              })
            }
            return [...data]
          })
        addThreads({
          renderOn: loop([
            sync({
              waitFor: [
                { type: 'add' },
                { type: 'run' },
                { type: 'runLots' },
                { type: 'clear' },
                { type: 'select' },
                { type: 'delete' },
                { type: 'swapRows' },
                { type: 'update' },
              ],
            }),
            sync({ request: { type: 'render' } }),
          ]),
        })
        feedback({
          add() {
            buildData(1000)
          },
          run() {
            buildData(1000)
          },
          runLots() {
            buildData(10000)
          },
          clear() {
            setData([])
          },
          interact(e: MouseEvent) {
            console.log(e.composedPath())
            const td = (e.target as HTMLElement)?.closest(
              'td',
            ) as HTMLTableCellElement
            const interaction = td.dataset.interaction
            //@ts-ignore:
            const id = parseInt(td.parentNode.id)
            if (interaction === 'delete') {
              trigger({ type: 'delete', detail: { id } })
            } else {
              trigger({ type: 'select', detail: { id } })
            }
          },
          delete({ id }: { id: number }) {
            setData((data) => {
              const idx = data.findIndex((d) => d.id === id)
              data.splice(idx, 1)
              return [...data]
            })
          },
          select({ id }: { id: number }) {
            setData((data) => {
              const cur = getSelected()
              if (cur > -1) {
                data[cur].selected = false
              }
              const next = data.findIndex((d) => d.id === id)
              setSelected(next)
              console.log(next)
              data[next].selected = true
              return [...data]
            })
          },
          swapRows() {
            setData((data) => {
              if (data.length > 998) {
                const tmp = data[1]
                data[1] = data[998]
                data[998] = tmp
              }
              return [...data]
            })
          },
          update() {
            setData((data) => {
              for (let i = 0; i < data.length; i += 10) {
                data[i].label += ' !!!'
              }
              return [...data]
            })
          },
          render() {
            const data = getData()
            const [table] = $('table')
            render(table, TableBodyTemplate({ data }))
          },
        })
      }
    },
)
