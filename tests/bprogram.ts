import { bProgram, bThread, loop, sync } from '$plaited'

const threads = {
  onClear: loop(bThread(sync({
    waitFor: { event: 'clear' },
    request: { event: 'clearDisplay' },
  }))),
  onLog: loop(bThread(
    sync({
      waitFor: { event: 'logMe' },
      request: { event: 'logSelf' },
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
