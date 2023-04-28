These docs will cover the following

Architecture best practices Behaviroal modules Comms module Storage module

## Exports

- bProgram: Class used to init a behavioral program.
- bProgram args:options object.
  - selection: a string `priority | randomized | chaos`
  - dev: a callback function to consume state chartsof the type DevCallback
- bProgram returns

**Example: tic-tac-toe**

```ts
import { assertEquals } from '../../dev-deps.ts'
import { bProgram, RulesFunc } from '../mod.ts'

Deno.test('preventCompletionOfLineWithTwoXs', () => {
  const { sync, addThreads, thread, feedback, trigger, loop } = bProgram()
  const actual: (
    | { player: 'X' | 'O'; square: number }
    | { player: 'X' | 'O'; win: number[] }
  )[] = []
  const playerWins = (player: string) =>
    winConditions.reduce((acc: Record<string, RulesFunc>, win) => {
      acc[`${player}Wins (${win})`] = thread(
        sync<{ square: number }>({
          waitFor: {
            cb: ({ event, detail }) =>
              event === player && win.includes(detail.square),
          },
        }),
        sync<{ square: number }>({
          waitFor: {
            cb: ({ event, detail }) =>
              event === player && win.includes(detail.square),
          },
        }),
        sync<{ square: number }>({
          waitFor: {
            cb: ({ event, detail }) =>
              event === player && win.includes(detail.square),
          },
        }),
        sync<{ win: number[] }>({
          request: { event: `${player}Win`, detail: { win } },
        }),
      )
      return acc
    }, {})
  const squaresTaken = squares.reduce(
    (acc: Record<string, RulesFunc>, square) => {
      acc[`(${square}) taken`] = thread(
        sync<{ square: number }>({
          waitFor: { cb: ({ detail }) => square === detail.square },
        }),
        sync<{ square: number }>({
          block: { cb: ({ detail }) => square === detail.square },
        }),
      )
      return acc
    },
    {},
  )

  const preventCompletionOfLineWithTwoXs = winConditions.reduce(
    (acc: Record<string, RulesFunc>, win) => {
      acc[`StopXWin(${win})`] = thread(
        sync<{ square: number }>({
          waitFor: {
            cb: ({ event, detail }) =>
              event === 'X' && win.includes(detail.square),
          },
        }),
        sync<{ square: number }>({
          waitFor: {
            cb: ({ event, detail }) =>
              event === 'X' && win.includes(detail.square),
          },
        }),
        sync<{ square: number }>({
          request: win.map((square) => ({ event: 'O', detail: { square } })),
        }),
      )
      return acc
    },
    {},
  )
  addThreads({
    ...playerWins('O'),
    ...playerWins('X'),
    enforceTurns: loop([
      sync({ waitFor: { event: 'X' }, block: { event: 'O' } }),
      sync({ waitFor: { event: 'O' }, block: { event: 'X' } }),
    ]),
    ...squaresTaken,
    stopGame: thread(
      sync({ waitFor: [{ event: 'XWin' }, { event: 'OWin' }] }),
      sync({ block: [{ event: 'X' }, { event: 'O' }] }),
    ),
    ...preventCompletionOfLineWithTwoXs,
    startAtCenter: thread(
      sync({
        request: {
          event: 'O',
          detail: { square: 4 },
        },
      }),
    ),
    defaultMoves: loop([
      sync({
        request: squares.map((square) => ({
          event: 'O',
          detail: { square },
        })),
      }),
    ]),
  })
  feedback({
    X({ square }: { square: number }) {
      actual.push({
        player: 'X',
        square,
      })
    },
    O({ square }: { square: number }) {
      actual.push({
        player: 'O',
        square,
      })
    },
    XWin({ win }: { win: [number, number, number] }) {
      actual.push({
        player: 'X',
        win,
      })
    },
    OWin({ win }: { win: [number, number, number] }) {
      actual.push({
        player: 'O',
        win,
      })
    },
  })
  trigger({ event: 'X', detail: { square: 0 } })
  trigger({ event: 'X', detail: { square: 3 } })
  //@ts-ignore: test
  assertEquals(actual, [
    { player: 'X', square: 0 },
    { player: 'O', square: 4 },
    { player: 'X', square: 3 },
    { player: 'O', square: 6 },
  ])
})
```
