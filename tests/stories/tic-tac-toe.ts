/* eslint-disable no-console */
import { bProgram, bThread, loop, RulesFunc, sync } from '$plaited'

const { trigger: xTrigger, feedback: xFeedback, add: xAdd } = bProgram({
  strategy: 'randomized',
})

const { trigger: oTrigger, feedback: oFeedback, add: oAdd } = bProgram({
  strategy: 'randomized',
})

const winConditions = [
  //rows
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  // columns
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  // diagonals
  [0, 4, 8],
  [2, 4, 6],
]

const squares = [0, 1, 2, 3, 4, 5, 6, 7, 8]
const squaresTaken = squares.reduce(
  (acc: Record<string, RulesFunc>, square) => {
    acc[`(${square}) taken`] = bThread(
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

const playerWins = (player: string) =>
  winConditions.reduce((acc: Record<string, RulesFunc>, win) => {
    acc[`${player}Wins (${win})`] = bThread(
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
        request: { event: `${player} Wins`, detail: { win } },
      }),
    )
    return acc
  }, {})

const enforceTurns = loop(
  bThread(
    sync({ waitFor: { event: 'X' }, block: { event: 'O' } }),
    sync({ waitFor: { event: 'O' }, block: { event: 'X' } }),
  ),
)

const playerMove = (player: string) =>
  loop(
    sync({
      request: squares.map((move) => ({
        event: player,
        detail: { square: move },
      })),
    }),
  )

const stopGame = bThread(
  sync({ waitFor: [{ event: 'X Wins' }, { event: 'O Wins' }] }),
  sync({ block: [{ event: 'X' }, { event: 'O' }] }),
)

const strands = {
  stopGame,
  ...squaresTaken,
  enforceTurns,
  ...playerWins('X'),
  ...playerWins('O'),
}

xAdd({
  ...strands,
  xMoves: playerMove('X'),
})

oAdd({
  ...strands,
  oMoves: playerMove('O'),
})

xFeedback({
  X(detail: { square: number }) {
    console.log({ event: 'X', detail })
    oTrigger({
      event: 'X',
      detail,
    })
  },
  ['X Wins'](detail: { win: number[] }) {
    console.log({ event: 'X Wins', detail })
  },
})

oFeedback({
  O(detail: { square: number }) {
    console.log({ event: 'O', detail })
    xTrigger({
      event: 'O',
      detail,
    })
  },
  ['O Wins'](detail: { win: number[] }) {
    console.log({ event: 'O Wins', detail })
  },
})

xTrigger({ event: 'start' })
