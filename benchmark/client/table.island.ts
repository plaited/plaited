import { isle, PlaitProps, useStore } from '$plaited'
import { connect } from './comms.ts'
import { Item } from './types.ts'
import { adjectives, colours, nouns, TableTag } from './constants.ts'

export const Table = isle(
  { tag: TableTag, connect },
  class extends HTMLElement {
    plait({ feedback, $, trigger }: PlaitProps) {
      const [_, setData] = useStore<Item[]>([])
      const [getSelected, setSelected] = useStore<
        Element | undefined
      >(undefined)
      const random = (max: number) => {
        return Math.round(Math.random() * 1000) % max
      }
      const render = (count: number) =>
        //dom manipulation
        setData((data) => {
          let did = data.at(-1)?.id ?? 0
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
        })
      const [tbody] = $<HTMLTableElement>('tbody')

      feedback({
        add() {
          render(1000)
        },
        run() {
          render(1000)
        },
        runLots() {
          render(10000)
        },
        clear() {
          setData([])
          tbody.replaceChildren()
        },
        interact(e: MouseEvent) {
          const td = e.target.closest('td')
          const interaction = td.dataset.interaction
          const id = parseInt(td.parentNode.id)
          if (interaction === 'delete') {
            trigger({ type: 'delete', detail: { id } })
          } else {
            console.log('hit select')
            trigger({ type: 'select', detail: { id } })
          }
        },
        delete({ id }: { id: number }) { // dom manipulate
          setData((data) => {
            const idx = data.findIndex((d) => d.id === id)
            tbody.children[idx].remove()
            data.splice(idx, 1)
            return data
          })
        },
        select({ id }: { id: number }) { // Dom manipulate
          setData((data) => {
            const cur = getSelected()
            if (cur) {
              cur.removeAttribute('selected')
              const index = Array.prototype.indexOf.call(tbody.children, cur)
              data[index].selected = false
            }
            const next = data.findIndex((d) => d.id === id)
            const nextSelected = tbody.children[next]
            nextSelected.setAttribute('selected', 'true')
            setSelected(nextSelected)
            data[next].selected = true
            return data
          })
        },
        swapRows() { // Dom Manipulate overwrite
          setData((data) => {
            if (data.length > 998) {
              const tmp = data[1]
              data[1] = data[998]
              data[998] = tmp
            }
            return data
          })
        },
        update() { // dom manipulate overwrite
          setData((data) => {
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
