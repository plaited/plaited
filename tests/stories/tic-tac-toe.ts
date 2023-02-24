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
        waitFor: { assert: ({ data }) => square === data },
      }),
      sets<number>({
        block: { assert: ({ data }) => square === data },
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
          assert: ({ type, data }) => type === player && win.includes(data),
        },
      }),
      sets<number>({
        waitFor: {
          assert: ({ type, data }) => type === player && win.includes(data),
        },
      }),
      sets<number>({
        waitFor: {
          assert: ({ type, data }) => type === player && win.includes(data),
        },
      }),
      sets({ request: { type: `${player} Wins`, data: win } }),
    )
    return acc
  }, {})

const enforceTurns = loop(
  bThread(
    sets({ waitFor: { type: 'X' }, block: { type: 'O' } }),
    sets({ waitFor: { type: 'O' }, block: { type: 'X' } }),
  ),
)

const playerMove = (player: string) =>
  loop(
    sets({
      request: squares.map((move) => ({ type: player, data: move })),
    }),
  )

const stopGame = bThread(
  sets({ waitFor: [{ type: 'X Wins' }, { type: 'O Wins' }] }),
  sets({ block: [{ type: 'X' }, { type: 'O' }] }),
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
  X(data: unknown) {
    console.log({ type: 'X', data })
    oTrigger({
      type: 'X',
      data: data,
    })
  },
  ['X Wins'](data: unknown) {
    console.log({ type: 'X Wins', data })
  },
})

oFeedback({
  O(data: number) {
    console.log({ type: 'O', data })
    xTrigger({
      type: 'O',
      data: data,
    })
  },
  ['O Wins'](data: [number, number, number]) {
    console.log({ type: 'O Wins', data })
  },
})

xTrigger({ type: 'start' })
