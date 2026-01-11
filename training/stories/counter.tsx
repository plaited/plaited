import { bElement } from 'plaited/ui'
import { hostStyles, styles } from './counter.css.ts'

export const Counter = bElement({
  tag: 'ui-counter',
  observedAttributes: ['max', 'min'],
  shadowDom: (
    <div {...styles.container}>
      <button
        type='button'
        p-target='decrement'
        p-trigger={{ click: 'clickDecrement' }}
        aria-label='Decrement'
        {...styles.button}
      >
        -
      </button>
      <span
        p-target='display'
        aria-live='polite'
        {...styles.display}
      >
        0
      </span>
      <button
        type='button'
        p-target='increment'
        p-trigger={{ click: 'clickIncrement' }}
        aria-label='Increment'
        {...styles.button}
      >
        +
      </button>
    </div>
  ),
  hostStyles,
  bProgram({ $, bThreads, bThread, bSync, trigger, attr }) {
    let count = 0
    const max = Number(attr.max ?? 10)
    const min = Number(attr.min ?? 0)

    // Register blocking constraints using bThread/bSync from context
    bThreads.set({
      blockIncrementAtMax: bThread(
        [
          bSync({
            block: ({ type }) => type === 'increment' && count >= max,
          }),
        ],
        true,
      ),
      blockDecrementAtMin: bThread(
        [
          bSync({
            block: ({ type }) => type === 'decrement' && count <= min,
          }),
        ],
        true,
      ),
    })

    const updateDisplay = () => {
      $('display')[0]?.render(<>{count}</>)
    }

    return {
      // DOM event handlers - trigger BP events
      clickIncrement() {
        trigger({ type: 'increment' })
      },
      clickDecrement() {
        trigger({ type: 'decrement' })
      },
      // BP event handlers - business logic (can be blocked by bThreads)
      increment() {
        count++
        updateDisplay()
      },
      decrement() {
        count--
        updateDisplay()
      },
    }
  },
})
