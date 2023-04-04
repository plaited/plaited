import { isle, PlaitedElement, PlaitProps, useStore } from '$plaited'
import { SugaredElement } from '../../../libs/islandly/sugar.ts'

const TableRow: PlaitedElement<
  { id: number; label: string; selected: boolean }
> = (item) => {
  return (
    <tr
      id={item.id}
      class={item.selected ? 'danger' : ''}
      data-target={item.id}
    >
      <td class='col-md-1'>{item.id}</td>
      <td class='col-md-4'>
        <a>{item.label}</a>
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

// const TableBodyTemplate: PlaitedElement<{
//   data: { id: number; label: string; selected: boolean }[]
// }> = ({ data }) => (
//   <>
//     {)}
//   </>
// )
export const TaggedBenchmark = isle(
  { tag: 'tagged-benchmark-island' },
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
        const [tbody] = $('tbody')
        feedback({
          add() {
            setData((old) => {
              const data = buildData(1000)
              tbody.render(
                <>{data.map((item) => <TableRow {...item} />)}</>,
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
              $(`${idx}`)[0].remove()
              return data
            })
          },
          select({ id }: { id: number }) {
            setData((data) => {
              const cur = getSelected()
              if (cur > -1) {
                data[cur].selected = false
                /** for keyed I'll probably want to use replace for this */
                $(`${data[cur].id}`)[0].attr('class', '')
              }
              const next = data.findIndex((d) => d.id === id)
              setSelected(next)
              $(`${data[next].id}`)[0].attr('class', 'danger')
              data[next].selected = true
              return data
            })
          },
          swapRows() {
            setData((data) => {
              if (data.length > 998) {
                const el1 = $(`2`)[0]
                const el2 = $(`999`)[0]
                el1.replace(<TableRow {...data[998]} />)
                el2.replace(<TableRow {...data[1]} />)
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
                $(`${data[i].id}`)[0].replace(
                  <TableRow {...data[i]} />,
                )
              }
              return data
            })
          },
          render() {
            const data = getData()
            tbody.render(<>{data.map((item) => <TableRow {...item} />)}</>)
          },
        })
      }
    },
)
