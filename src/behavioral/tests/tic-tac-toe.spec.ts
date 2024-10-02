import { test, expect } from 'bun:test'
import { bProgram } from '../b-program.js'
import { bThread, bSync, RulesFunction } from '../b-thread.js'

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

let board: Set<number>
type Square = { square: number }

test('taking a square', () => {
  // We create a new bProgram
  const { useFeedback, trigger } = bProgram()
  // We create a new board for the game
  board = new Set(squares)
  useFeedback({
    // When BPEvent X happens we delete the square provided in the event's detail
    X({ square }: Square) {
      board.delete(square)
    },
    // When BPEvent X happens we delete the square provided in the event's detail
    O({ square }: Square) {
      board.delete(square)
    },
  })
  // X takes square 1
  trigger({ type: 'X', detail: { square: 1 } })
  // We check to make sure it's no longer available on the board
  expect(board.has(1)).toBe(false)
  // O takes square 0
  trigger({ type: 'O', detail: { square: 0 } })
  // We check to make sure it's no longer available on the board
  expect(board.has(0)).toBe(false)
})

const enforceTurns = bThread([bSync({ waitFor: 'X', block: 'O' }), bSync({ waitFor: 'O', block: 'X' })], true)

test('take turns', () => {
  // We create a new bProgram
  const { useFeedback, trigger, bThreads } = bProgram()
  // We create a new board for the game
  board = new Set(squares)
  bThreads.set({
    enforceTurns,
  })
  useFeedback({
    // When BPEvent X happens we delete the square provided in the event's detail
    X({ square }: Square) {
      board.delete(square)
    },
    // When BPEvent X happens we delete the square provided in the event's detail
    O({ square }: Square) {
      board.delete(square)
    },
  })
  // X takes square 1
  trigger({ type: 'X', detail: { square: 1 } })
  // We check to make sure it's no longer available on the board
  expect(board.has(1)).toBe(false)
  // O takes square 0
  trigger({ type: 'O', detail: { square: 0 } })
  // We check to make sure it's no longer available on the board
  expect(board.has(0)).toBe(false)
  // O tries to take another turn out of order
  trigger({ type: 'O', detail: { square: 2 } })
  // We check to make sure 2 is still in the board
  expect(board.has(2)).toBe(true)
})

const squaresTaken: Record<string, RulesFunction> = {}
for (const square of squares) {
  squaresTaken[`(${square}) taken`] = bThread([
    bSync<{ square: number }>({ waitFor: ({ detail }) => square === detail.square }),
    bSync<{ square: number }>({ block: ({ detail }) => square === detail.square }),
  ])
}

test('squares taken', () => {
  // We create a new bProgram
  const { useFeedback, trigger, bThreads } = bProgram()
  // We create a new board for the game
  board = new Set(squares)
  bThreads.set({
    enforceTurns,
    ...squaresTaken,
  })
  useFeedback({
    // When BPEvent X happens we delete the square provided in the event's detail
    X({ square }: Square) {
      board.delete(square)
    },
    // When BPEvent X happens we delete the square provided in the event's detail
    O({ square }: Square) {
      board.delete(square)
    },
  })
  // X takes square 1
  trigger({ type: 'X', detail: { square: 1 } })
  // We check to make sure it's no longer available on the board
  expect(board.has(1)).toBe(false)
  // O takes square 0
  trigger({ type: 'O', detail: { square: 0 } })
  // We check to make sure it's no longer available on the board
  expect(board.has(0)).toBe(false)
  // X tries to take square 1 again
  trigger({ type: 'X', detail: { square: 1 } })
  // O takes tries to take square 2
  trigger({ type: 'O', detail: { square: 2 } })
  // O can't because it's X's turn still as their move was not valid
  expect(board.has(2)).toBe(true)
  trigger({ type: 'X', detail: { square: 2 } })
  expect(board.has(2)).toBe(false)
})

type Winner = { player: 'X' | 'O'; squares: number[] }
const detectWins = (player: 'X' | 'O') =>
  winConditions.reduce((acc: Record<string, RulesFunction>, squares) => {
    acc[`${player}Wins (${squares})`] = bThread([
      bSync<{ square: number }>({
        waitFor: ({ type, detail }) => type === player && squares.includes(detail.square),
      }),
      bSync<{ square: number }>({
        waitFor: ({ type, detail }) => type === player && squares.includes(detail.square),
      }),
      bSync<{ square: number }>({
        waitFor: ({ type, detail }) => type === player && squares.includes(detail.square),
      }),
      bSync<Winner>({
        request: { type: 'win', detail: { squares, player } },
      }),
    ])
    return acc
  }, {})

test('detect winner', () => {
  // We create a new bProgram
  const { useFeedback, trigger, bThreads } = bProgram()
  // We create a new board for the game
  board = new Set(squares)
  bThreads.set({
    enforceTurns,
    ...squaresTaken,
    ...detectWins('X'),
    ...detectWins('O'),
  })
  let winner: Winner
  useFeedback({
    // When BPEvent `X` happens we delete the square provided in the event's detail
    X({ square }: { square: number }) {
      board.delete(square)
    },
    // // When BPEvent `O` happens we delete the square provided in the event's detail
    O({ square }: { square: number }) {
      board.delete(square)
    },
    // When BPEvent `win` happens we set the winner
    win(detail: Winner) {
      winner = detail
    },
  })
  trigger({ type: 'X', detail: { square: 0 } })
  trigger({ type: 'O', detail: { square: 3 } })
  trigger({ type: 'X', detail: { square: 1 } })
  trigger({ type: 'O', detail: { square: 4 } })
  trigger({ type: 'X', detail: { square: 2 } })
  // @ts-expect-error: testing winner
  expect(winner).toEqual({ player: 'X', squares: [0, 1, 2] })
})

const stopGame = bThread([bSync({ waitFor: 'win' }), bSync({ block: ['X', 'O'] })], true)

test('stop game', () => {
  // We create a new bProgram
  const { useFeedback, trigger, bThreads } = bProgram()
  // We create a new board for the game
  board = new Set(squares)
  bThreads.set({
    enforceTurns,
    ...squaresTaken,
    ...detectWins('X'),
    ...detectWins('O'),
    stopGame,
  })
  let winner: Winner
  useFeedback({
    // When BPEvent `X` happens we delete the square provided in the event's detail
    X({ square }: { square: number }) {
      board.delete(square)
    },
    // When BPEvent `O` happens we delete the square provided in the event's detail
    O({ square }: { square: number }) {
      board.delete(square)
    },
    // When BPEvent `win` happens we set the winner
    win(detail: Winner) {
      winner = detail
    },
  })
  trigger({ type: 'X', detail: { square: 0 } })
  trigger({ type: 'O', detail: { square: 3 } })
  trigger({ type: 'X', detail: { square: 1 } })
  trigger({ type: 'O', detail: { square: 4 } })
  trigger({ type: 'X', detail: { square: 2 } })
  // @ts-expect-error: testing winner
  expect(winner).toEqual({ player: 'X', squares: [0, 1, 2] })
  // O tries to take square 5 after a winner has been declared
  trigger({ type: 'O', detail: { square: 5 } })
  expect(board.has(5)).toBe(true)
})

const defaultMoves: Record<string, RulesFunction> = {}
for (const square of squares) {
  defaultMoves[`defaultMoves(${square})`] = bThread(
    [
      bSync<Square>({
        request: {
          type: 'O',
          detail: { square },
        },
      }),
    ],
    true,
  )
}

test('defaultMoves', () => {
  // We create a new bProgram
  const { useFeedback, trigger, bThreads } = bProgram()
  // We create a new board for the game
  board = new Set(squares)
  bThreads.set({
    enforceTurns,
    ...squaresTaken,
    ...detectWins('X'),
    ...detectWins('O'),
    stopGame,
    ...defaultMoves,
  })

  useFeedback({
    // When BPEvent `X` happens we delete the square provided in the event's detail
    X({ square }: { square: number }) {
      board.delete(square)
    },
    // When BPEvent `O` happens we delete the square provided in the event's detail
    O({ square }: { square: number }) {
      board.delete(square)
    },
  })
  trigger({ type: 'X', detail: { square: 0 } })
  expect(board.has(1)).toBe(false)
})

const startAtCenter = bSync({
  request: {
    type: 'O',
    detail: { square: 4 },
  },
})

test('start at center', () => {
  // We create a new bProgram
  const { useFeedback, trigger, bThreads } = bProgram()
  // We create a new board for the game
  board = new Set(squares)
  bThreads.set({
    enforceTurns,
    ...squaresTaken,
    ...detectWins('X'),
    ...detectWins('O'),
    stopGame,
    startAtCenter,
    ...defaultMoves,
  })

  useFeedback({
    // When BPEvent `X` happens we delete the square provided in the event's detail
    X({ square }: { square: number }) {
      board.delete(square)
    },
    // When BPEvent `O` happens we delete the square provided in the event's detail
    O({ square }: { square: number }) {
      board.delete(square)
    },
  })
  trigger({ type: 'X', detail: { square: 0 } })
  expect(board.has(4)).toBe(false)
})
const preventCompletionOfLineWithTwoXs = (board: Set<number>) => {
  const bThreads: Record<string, RulesFunction> = {}
  for (const win of winConditions) {
    bThreads[`StopXWin(${win})`] = bThread([
      bSync<Square>({
        waitFor: ({ type, detail }) => type === 'X' && win.includes(detail.square),
      }),
      bSync<Square>({
        waitFor: ({ type, detail }) => type === 'X' && win.includes(detail.square),
      }),
      bSync<Square>({
        request: () => ({ type: 'O', detail: { square: win.find((num) => board.has(num)) as number } }),
      }),
    ])
  }
  return bThreads
}

test('prevent completion of line with two Xs', () => {
  // We create a new bProgram
  const { useFeedback, trigger, bThreads } = bProgram()
  // We create a new board for the game
  board = new Set(squares)
  bThreads.set({
    enforceTurns,
    ...squaresTaken,
    ...detectWins('X'),
    ...detectWins('O'),
    stopGame,
    ...preventCompletionOfLineWithTwoXs(board),
    startAtCenter,
    ...defaultMoves,
  })
  let winner: Winner
  useFeedback<{
    X: (detail: Square) => void
    O: (detail: Square) => void
    win: (detail: Winner) => void
  }>({
    // When BPEvent `X` happens we delete the square provided in the event's detail
    X({ square }) {
      board.delete(square)
    },
    // When BPEvent `O` happens we delete the square provided in the event's detail
    O({ square }) {
      board.delete(square)
    },
    // When BPEvent `win` happens we set the winner
    win(detail) {
      winner = detail
    },
  })
  trigger({ type: 'X', detail: { square: 2 } })
  trigger({ type: 'X', detail: { square: 6 } })
  trigger({ type: 'X', detail: { square: 8 } })
  expect(board.has(7)).toBe(false) // O has blocked X from winning with [6, 7, 8]
  trigger({ type: 'X', detail: { square: 5 } })
  // @ts-expect-error: testing winner
  expect(winner).toEqual({ player: 'X', squares: [2, 5, 8] })
})
