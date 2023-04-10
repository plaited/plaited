import { isle, PlaitedElement, PlaitProps, useStore } from '$plaited'

type RowAttrs = { id: number; label: string; selected: boolean }
const TableRow: PlaitedElement<RowAttrs> = (item) => {
  return (
    <tr
      id={item.id}
      class={item.selected ? 'danger' : ''}
      data-target={item.id}
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
export const Benchmark = isle(
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
        const [getData, setData] = useStore<
          { id: number; label: string; selected: boolean }[]
        >([])
        const [getSelected, setSelected] = useStore(-1)
        const random = (max: number) => {
          return Math.round(Math.random() * 1000) % max
        }
        let did = getData().at(-1)?.id || 1
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
        addThreads({
          renderOn: loop([
            sync({
              waitFor: [
                { type: 'run' },
                { type: 'runLots' },
                { type: 'clear' },
              ],
            }),
            sync({ request: { type: 'render' } }),
          ]),
        })
        const tbody = $('tbody')
        feedback({
          add() {
            setData((old) => {
              const data = buildData(1000)
              tbody?.render(
                <>{data.map((d) => <TableRow {...d} />)}</>,
                'beforeend',
              )
              return old.concat(data)
            })
          },
          run() {
            setData(buildData(1000))
          },
          runLots() {
            setData(buildData(10000))
          },
          clear() {
            setData([])
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
            setData((data) => {
              const idx = data.findIndex((d) => d.id === id)
              data.splice(idx, 1)
              $(`${id}`)?.remove()
              return data
            })
          },
          select({ id }: { id: number }) {
            setData((data) => {
              const cur = getSelected()
              if (cur > -1) {
                data[cur].selected = false
                $(`${data[cur].id}`)?.attr('class', '')
              }
              const next = data.findIndex((d) => d.id === id)
              setSelected(next)
              data[next].selected = true
              $(`${data[next].id}`)?.attr('class', 'danger')
              return data
            })
          },
          swapRows() {
            setData((data) => {
              if (data.length > 998) {
                let node = $(`${data[1].id}`), before = $(`${data[999].id}`)
                if (node && before) {
                  tbody?.insertBefore(node, before)
                }
                node = $(`${data[998].id}`), before = $(`${data[2].id}`)
                if (node && before) {
                  tbody?.insertBefore(node, before)
                }
                const tmp = data[1]
                data[1] = data[998]
                data[998] = tmp
              }
              return data
            })
          },
          update() {
            setData((data) => {
              for (let i = 0; i < data.length; i += 10) {
                data[i].label += ' !!!'
                const label = $<HTMLElement>(`label-${data[i].id}`)
                label && (label.innerText = data[i].label)
              }
              return data
            })
          },
          render() {
            tbody?.render(
              <>{getData().map((data) => <TableRow {...data} />)}</>,
            )
          },
        })
      }
    },
)
