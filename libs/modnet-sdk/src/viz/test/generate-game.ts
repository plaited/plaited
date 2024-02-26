import { bProgram, sync, loop, thread, RulesFunction, DefaultLogCallbackParams, BPEvent } from 'plaited'
import { useLogger } from '../use-logger.js'


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

type Square = { square: number }

const enforceTurns = loop(sync<Square>({ waitFor: 'X', block: 'O' }), sync<Square>({ waitFor: 'O', block: 'X' }))

const squaresTaken: Record<string, RulesFunction> = {}
for (const square of squares) {
  squaresTaken[`(${square}) taken`] = thread(
    sync<Square>({
      waitFor: ({ detail }) => square === detail?.square,
    }),
    sync<Square>({
      block: ({ detail }) => square === detail?.square,
    }),
  )
}

type Winner = { player: 'X' | 'O'; squares: number[] }

const detectWins = (player: 'X' | 'O') =>
  winConditions.reduce((acc: Record<string, RulesFunction>, squares) => {
    acc[`${player}Wins (${squares})`] = thread(
      sync<{ square: number }>({
        waitFor: ({ type, detail }) => type === player && squares.includes(detail?.square),
      }),
      sync<{ square: number }>({
        waitFor: ({ type, detail }) => type === player && squares.includes(detail?.square),
      }),
      sync<{ square: number }>({
        waitFor: ({ type, detail }) => type === player && squares.includes(detail?.square),
      }),
      sync<Winner>({
        request: { type: 'win', detail: { squares, player } },
      }),
    )
    return acc
  }, {})

const stopGame = thread(sync({ waitFor: 'win' }), sync({ block: ['X', 'O'] }))

const defaultMoves: Record<string, RulesFunction> = {}
for (const square of squares) {
  defaultMoves[`defaultMoves(${square})`] = loop(
    sync<Square>({
      request: {
        type: 'O',
        detail: { square },
      },
    }),
  )
}

const startAtCenter = sync({
  request: {
    type: 'O',
    detail: { square: 4 },
  },
})

const preventCompletionOfLineWithTwoXs = (board: Set<number>) => {
  const threads: Record<string, RulesFunction> = {}
  for (const win of winConditions) {
    threads[`StopXWin(${win})`] = thread(
      sync<Square>({
        waitFor: ({ type, detail }) => type === 'X' && win.includes(detail?.square),
      }),
      sync<Square>({
        waitFor: ({ type, detail }) => type === 'X' && win.includes(detail?.square),
      }),
      sync<Square>({
        request: () => ({ type: 'O', detail: { square: win.find((num) => board.has(num)) || 0 } }),
      }),
    )
  }
  return threads
}

const onNoWin = thread(...squares.map((_) => sync({ waitFor: ['X', 'O'] })), sync({ request: { type: 'noWin' } }))
const onWin = thread(sync({ waitFor: 'win' }), sync({ block: 'noWin' }))

export const runs: DefaultLogCallbackParams[][] = []

export const games = [
  // No winner
  [
    { type: 'X', detail: { square: 4 } },
    { type: 'X', detail: { square: 2 } },
    { type: 'X', detail: { square: 3 } },
    { type: 'X', detail: { square: 7 } },
    { type: 'X', detail: { square: 8 } },
  ],
  // X wins in four moves
  [
    { type: 'X', detail: { square: 2 } },
    { type: 'X', detail: { square: 6 } },
    { type: 'X', detail: { square: 8 } },
    { type: 'X', detail: { square: 5 } },
  ],
  // X wins in five moves
  [
    { type: 'X', detail: { square: 4 } },
    { type: 'X', detail: { square: 7 } },
    { type: 'X', detail: { square: 6 } },
    { type: 'X', detail: { square: 3 } },
    { type: 'X', detail: { square: 2 } },
  ],
  // O wins in 3 moves
  [
    { type: 'X', detail: { square: 0 } },
    { type: 'X', detail: { square: 1 } },
    { type: 'X', detail: { square: 3 } },
  ],
]

export const generate = (game: BPEvent[]) => {
  const log: DefaultLogCallbackParams[] = []
  const logger = useLogger(log)
  const { addThreads, feedback, trigger } = bProgram(logger)
  const board = new Set(squares)
  addThreads({
    enforceTurns,
    ...squaresTaken,
    ...detectWins('X'),
    ...detectWins('O'),
    stopGame,
    ...preventCompletionOfLineWithTwoXs(board),
    startAtCenter,
    ...defaultMoves,
    onNoWin,
    onWin,
  })
  feedback({
    // When BPEvent `X` happens we delete the square provided in the event's detail
    X({ square }: { square: number }) {
      board.delete(square)
    },
    // When BPEvent `O` happens we delete the square provided in the event's detail
    O({ square }: { square: number }) {
      board.delete(square)
    },
  })
  for (const event of game) trigger(event)
  runs.push(log)
}

// for (const game of games) generate(game)

// const dot = generateDot(runs)
// const svg = await dotToSVG(dot)

// const formattedSVG = formatSVG(svg!)

// console.log(formattedSVG)