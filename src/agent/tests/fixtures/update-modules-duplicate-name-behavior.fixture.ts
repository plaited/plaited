import { useModule } from '../../use-module.ts'

const FIXTURE_PING_EVENT = 'fixture_ping'
const FIRST_PONG_EVENT = 'fixture_pong_first'
const SECOND_PONG_EVENT = 'fixture_pong_second'

const first = useModule('memory', ({ emit }) => ({
  handlers: {
    [FIXTURE_PING_EVENT]() {
      emit({
        type: FIRST_PONG_EVENT,
        detail: { installed: 'first' },
      })
    },
  },
}))

const second = useModule('memory', ({ emit }) => ({
  handlers: {
    [FIXTURE_PING_EVENT]() {
      emit({
        type: SECOND_PONG_EVENT,
        detail: { installed: 'second' },
      })
    },
  },
}))

export default [first, second]
