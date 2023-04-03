import { isle, PlaitedElement, PlaitProps, useStore } from '$plaited'

const TableBodyTemplate: PlaitedElement<{
  data: { id: number; label: string; selected: boolean }[]
}> = ({ data }) => (
  <>
    {data.map((item: { id: number; label: string; selected: boolean }) => (
      <tr id={item.id} className={item.selected ? 'danger' : ''}>
        <td className='col-md-1'>{item.id}</td>
        <td className='col-md-4'>
          <a>{item.label}</a>
        </td>
        <td data-id={item.id} className='col-md-1' data-interaction='delete'>
          <a>
            <span className='glyphicon glyphicon-remove' aria-hidden='true'>
            </span>
          </a>
        </td>
        <td className='col-md-6'></td>
      </tr>
    ))}
  </>
)
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
            setData((old) => old.concat(buildData(1000)))
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
              return data
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
              data[next].selected = true
              return data
            })
          },
          swapRows() {
            setData((data) => {
              if (data.length > 998) {
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
              }
              return data
            })
          },
          render() {
            const data = getData()
            const [tbody] = $('tbody')
            tbody.render(<TableBodyTemplate data={data} />)
          },
        })
      }
    },
)
