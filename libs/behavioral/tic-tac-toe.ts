/* eslint-disable no-console */
import { bProgram, loop, RulesFunc, sync, thread } from './mod.ts'

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
    acc[`(${square}) taken`] = thread(
      sync({ waitFor: { cb: ({ detail }) => square === detail.square } }),
      sync({ waitFor: { cb: ({ detail }) => square === detail.square } }),
    )

    return acc
  },
  {},
)

const playerWins = (player: string) =>
  winConditions.reduce((acc: Record<string, RulesFunc>, win) => {
    acc[`${player}Wins (${win})`] = thread(
      sync({
        waitFor: {
          cb: ({ event, detail }) =>
            event === player && win.includes(detail.square),
        },
      }),
      sync({
        waitFor: {
          cb: ({ event, detail }) =>
            event === player && win.includes(detail.square),
        },
      }),
      sync({
        waitFor: {
          cb: ({ event, detail }) =>
            event === player && win.includes(detail.square),
        },
      }),
      sync({ request: { event: `${player} Wins`, detail: { win } } }),
    )
    return acc
  }, {})

const enforceTurns = loop([
  sync({ waitFor: { event: 'X' }, block: { event: 'O' } }),
  sync({ waitFor: { event: 'O' }, block: { event: 'X' } }),
])

const playerMove = (player: string) =>
  loop([
    sync({
      request: squares.map((square) => ({ event: player, detail: { square } })),
    }),
  ])

const stopGame = thread(
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

const { trigger: xTrigger, feedback: xFeedback, addRules: xAdd } = bProgram({
  strategy: 'randomized',
})

xAdd({
  ...strands,
  oMoves: playerMove('X'),
})

const { trigger: oTrigger, feedback: oFeedback, addRules: oAdd } = bProgram({
  strategy: 'randomized',
})
oAdd({
  ...strands,
  xMoves: playerMove('O'),
})

const xActions = {
  X(detail: { square: number }) {
    console.log({ event: 'X', detail })
    oTrigger({
      event: 'X',
      detail,
    })
  },
  ['X Wins'](detail: unknown) {
    console.log({ event: 'X Wins', detail })
  },
}
xFeedback(xActions)

const oActions = {
  O(detail: { square: number }) {
    console.log({ event: 'O', detail })
    xTrigger({
      event: 'O',
      detail,
    })
  },
  ['O Wins'](detail: unknown) {
    console.log({ event: 'O Wins', detail })
  },
}
oFeedback(oActions)

xTrigger({ event: 'start' })
