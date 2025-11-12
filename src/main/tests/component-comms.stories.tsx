import { bElement, type FT, useSignal } from 'plaited'
import { story } from 'plaited/testing'

const sendDisable = useSignal()
const sendAdd = useSignal<{ value: string }>()

const ElOne = bElement({
  tag: 'elemenmt-one',
  publicEvents: ['disable'],
  shadowDom: (
    <div>
      <button
        p-target='button'
        p-trigger={{ click: 'click' }}
      >
        Add "world!"
      </button>
    </div>
  ),
  bProgram({ $, trigger }) {
    const disconnect = sendDisable.listen('disable', trigger)
    return {
      disable() {
        const [button] = $<HTMLButtonElement>('button')
        button && button.attr('disabled', true)
        disconnect()
      },
      click() {
        sendAdd.set({ value: ' World!' })
      },
    }
  },
})

const ElTwo = bElement({
  tag: 'element-two',
  publicEvents: ['add'],
  shadowDom: <h1 p-target='header'>Hello</h1>,
  bProgram({ $, bThread, bThreads, bSync, trigger }) {
    sendAdd.listen('add', trigger)
    bThreads.set({
      onAdd: bThread([bSync({ waitFor: 'add' }), bSync({ request: { type: 'disable' } })]),
    })
    return {
      disable() {
        sendDisable.set()
      },
      add(detail: { value: string }) {
        const [header] = $('header')
        header.insert('beforeend', <>{detail.value}</>)
      },
    }
  },
})

const ComponentComms: FT = () => {
  return (
    <>
      <ElOne />
      <ElTwo />
    </>
  )
}

export const componentComms = story<typeof ComponentComms>({
  template: ComponentComms,
  description: `Example of how to use useSignal to enable communication between
  Behavioral elements. This story is used to validate that when the button in element-one
  is clicked it leads to an appending a string to the h1 in element-two`,
  play: async ({ findByAttribute, assert, fireEvent }) => {
    let button = await findByAttribute('p-target', 'button')
    const header = await findByAttribute('p-target', 'header')
    assert({
      given: 'render',
      should: 'header should contain string',
      actual: header?.textContent,
      expected: 'Hello',
    })
    button && (await fireEvent(button, 'click'))
    assert({
      given: 'clicking button',
      should: 'append string to header',
      actual: header?.innerHTML,
      expected: 'Hello World!',
    })
    button = await findByAttribute('p-target', 'button')
    assert({
      given: 'clicking button',
      should: 'be disabled',
      actual: (button as HTMLButtonElement)?.disabled,
      expected: true,
    })
  },
})
