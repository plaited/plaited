import * as z from 'zod'
import { useModule } from '../../../behavioral/use-module.old.ts'

const FIXTURE_PING_EVENT = 'fixture_ping'
const FIRST_PING_SEEN_EVENT = 'fixture_ping_seen_first'
const SECOND_PING_SEEN_EVENT = 'fixture_ping_seen_second'
const FIRST_PONG_EVENT = 'fixture_pong_first'
const SECOND_PONG_EVENT = 'fixture_pong_second'
const FixturePingEventSchema = z.object({
  type: z.literal(FIXTURE_PING_EVENT),
  detail: z.unknown(),
})
const FirstPingSeenEventSchema = z.object({
  type: z.literal(FIRST_PING_SEEN_EVENT),
  detail: z.undefined(),
})
const SecondPingSeenEventSchema = z.object({
  type: z.literal(SECOND_PING_SEEN_EVENT),
  detail: z.undefined(),
})
const FirstPongEventSchema = z.object({
  type: z.literal(FIRST_PONG_EVENT),
  detail: z.object({ installed: z.string() }),
})
const SecondPongEventSchema = z.object({
  type: z.literal(SECOND_PONG_EVENT),
  detail: z.object({ installed: z.string() }),
})

const first = useModule('memory', ({ local, external, bSync, bThread, emit, last }) => {
  const fixturePing = external(FixturePingEventSchema)
  const fixturePingFromTrigger = fixturePing.on(z.literal('trigger'))
  const pingSeen = local(FirstPingSeenEventSchema)
  const firstPong = external(FirstPongEventSchema)
  return {
    threads: {
      onFixturePing: bThread(
        [
          bSync({
            waitFor: fixturePingFromTrigger,
          }),
          bSync({
            request: pingSeen.request(),
          }),
        ],
        true,
      ),
    },
    handlers: {
      [pingSeen.type]() {
        void last(fixturePingFromTrigger)
        emit(firstPong.request({ installed: 'first' }))
      },
    },
  }
})

const second = useModule('memory', ({ local, external, bSync, bThread, emit, last }) => {
  const fixturePing = external(FixturePingEventSchema)
  const fixturePingFromTrigger = fixturePing.on(z.literal('trigger'))
  const pingSeen = local(SecondPingSeenEventSchema)
  const secondPong = external(SecondPongEventSchema)
  return {
    threads: {
      onFixturePing: bThread(
        [
          bSync({
            waitFor: fixturePingFromTrigger,
          }),
          bSync({
            request: pingSeen.request(),
          }),
        ],
        true,
      ),
    },
    handlers: {
      [pingSeen.type]() {
        void last(fixturePingFromTrigger)
        emit(secondPong.request({ installed: 'second' }))
      },
    },
  }
})

export default [first, second]
