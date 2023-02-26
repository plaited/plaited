import { bProgram, bThread, loop, sync } from '../mod.ts'

const threads = {
  onClear: loop(bThread(
    sync({
      waitFor: { event: 'clear' },
    }),
    sync({
      request: { event: 'clearDisplay' },
    }),
  )),
}

const { add, trigger, feedback } = bProgram({})

add(threads)

feedback({
  clearDisplay() {
    console.log('clearing')
  },
})

trigger({ event: 'clear' })
trigger({ event: 'clear' })
