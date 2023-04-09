import {
  isle,
  PlaitedElement,
  PlaitProps,
  Render,
  Update,
  useRender,
  useStore,
} from '$plaited'

type RowAttrs = { id: number; label: string; selected: boolean }
const TableRow: PlaitedElement<RowAttrs> = (item) => {
  return (
    <tr
      id={item.id}
      class={item.selected ? 'danger' : ''}
    >
      <td class='col-md-1'>{item.id}</td>
      <td class='col-md-4'>
        <a data-target={`label-${item.id}`}>{item.label}</a>
      </td>
      <td data-id={item.id} class='col-md-1' data-interaction='delete'>
        <a>
          <span class='glyphicon glyphicon-remove' aria-hidden='true'>
          </span>
        </a>
      </td>
      <td class='col-md-6'></td>
    </tr>
  )
}
export const BenchmarkIsland = isle(
  { tag: 'benchmark-island' },
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

        const [getSelected, setSelected] = useStore(-1)
        const random = (max: number) => {
          return Math.round(Math.random() * 1000) % max
        }
        let did = 1
        const buildData = (count: number) => {
          const data = []
          for (let i = 0; i < count; i++) {
            data.push({
              id: did++,
              label: `${adjectives[random(adjectives.length)]} ${
                colours[random(colours.length)]
              } ${nouns[random(nouns.length)]}`,
              selected: false,
            })
          }
          return data
        }
        const tbody = $('tbody')
        let render: Render<RowAttrs[]>,
          update: Update<RowAttrs[]>
        tbody &&
          ([render, update] = useRender<RowAttrs[]>(
            tbody,
            TableRow,
          ))
        feedback({
          add() {
            update((old) => {
              const data = buildData(1000)
              const next = old.concat(data)
              return next
            })
          },
          run() {
            render(buildData(1000))
          },
          runLots() {
            render(buildData(10000))
          },
          clear() {
            render([])
          },
          interact(e: MouseEvent) {
            const td = (e.target as HTMLElement)?.closest<HTMLTableCellElement>(
              'td',
            )
            if (td) {
              const interaction = td.dataset.interaction
              const id = parseInt((td.parentNode as Element).id)
              if (interaction === 'delete') {
                trigger({ type: 'delete', detail: { id } })
              } else {
                trigger({ type: 'select', detail: { id } })
              }
            }
          },
          delete({ id }: { id: number }) {
            update((data) => {
              const idx = data.findIndex((d) => d.id === id)
              data.splice(idx, 1)
              return data
            })
          },
          select({ id }: { id: number }) {
            update((data) => {
              const cur = getSelected()
              if (cur > -1) {
                data[cur].selected = false
              }
              const next = data.findIndex((d) => d.id === id)
              setSelected(next)
              data[next].selected = true
              return data
            })
          },
          swapRows() {
            update((data) => {
              if (data.length > 998) {
                const tmp = data[1]
                data[1] = data[998]
                data[998] = tmp
              }
              return data
            })
          },
          update() {
            update((data) => {
              for (let i = 0; i < data.length; i += 10) {
                data[i].label += ' !!!'
              }
              return data
            })
          },
        })
      }
    },
)
