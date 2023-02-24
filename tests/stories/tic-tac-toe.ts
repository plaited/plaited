/* eslint-disable no-console */
import {
  bProgram,
  bThread,
  loop,
  randomizedStrategy,
  RulesFunc,
  sets,
} from '$plaited'

const { trigger: xTrigger, feedback: xFeedback, add: xAdd } = bProgram({
  strategy: randomizedStrategy,
})

const { trigger: oTrigger, feedback: oFeedback, add: oAdd } = bProgram({
  strategy: randomizedStrategy,
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
      sets<number>({
        waitFor: { assert: ({ payload }) => square === payload },
      }),
      sets<number>({
        block: { assert: ({ payload }) => square === payload },
      }),
    )
    return acc
  },
  {},
)

const playerWins = (player: string) =>
  winConditions.reduce((acc: Record<string, RulesFunc>, win) => {
    acc[`${player}Wins (${win})`] = bThread(
      sets<number>({
        waitFor: {
          assert: ({ event, payload }) =>
            event === player && win.includes(payload),
        },
      }),
      sets<number>({
        waitFor: {
          assert: ({ event, payload }) =>
            event === player && win.includes(payload),
        },
      }),
      sets<number>({
        waitFor: {
          assert: ({ event, payload }) =>
            event === player && win.includes(payload),
        },
      }),
      sets({ request: { event: `${player} Wins`, payload: win } }),
    )
    return acc
  }, {})

const enforceTurns = loop(
  bThread(
    sets({ waitFor: { event: 'X' }, block: { event: 'O' } }),
    sets({ waitFor: { event: 'O' }, block: { event: 'X' } }),
  ),
)

const playerMove = (player: string) =>
  loop(
    sets({
      request: squares.map((move) => ({ event: player, payload: move })),
    }),
  )

const stopGame = bThread(
  sets({ waitFor: [{ event: 'X Wins' }, { event: 'O Wins' }] }),
  sets({ block: [{ event: 'X' }, { event: 'O' }] }),
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
  X(payload: unknown) {
    console.log({ event: 'X', payload })
    oTrigger({
      event: 'X',
      payload: payload,
    })
  },
  ['X Wins'](payload: unknown) {
    console.log({ event: 'X Wins', payload })
  },
})

oFeedback({
  O(payload: number) {
    console.log({ event: 'O', payload })
    xTrigger({
      event: 'O',
      payload: payload,
    })
  },
  ['O Wins'](payload: [number, number, number]) {
    console.log({ event: 'O Wins', payload })
  },
})

xTrigger({ event: 'start' })
