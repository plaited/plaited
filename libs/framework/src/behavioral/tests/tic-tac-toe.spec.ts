import { test, expect } from 'bun:test'
import { RulesFunction } from '../../types.js'
import { bProgram } from '../b-program.js'
import { loop, sync, thread } from '../rules.js'

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
  const { feedback, trigger } = bProgram()
  // We create a new board for the game
  board = new Set(squares)
  feedback({
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

const enforceTurns = loop(sync<Square>({ waitFor: 'X', block: 'O' }), sync<Square>({ waitFor: 'O', block: 'X' }))

test('take turns', () => {
  // We create a new bProgram
  const { feedback, trigger, addThreads } = bProgram()
  // We create a new board for the game
  board = new Set(squares)
  addThreads({
    enforceTurns,
  })
  feedback({
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
  squaresTaken[`(${square}) taken`] = thread(
    sync<Square>({
      waitFor: ({ detail }) => square === detail.square,
    }),
    sync<Square>({
      block: ({ detail }) => square === detail.square,
    }),
  )
}

test('squares taken', () => {
  // We create a new bProgram
  const { feedback, trigger, addThreads } = bProgram()
  // We create a new board for the game
  board = new Set(squares)
  addThreads({
    enforceTurns,
    ...squaresTaken,
  })
  feedback({
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
    acc[`${player}Wins (${squares})`] = thread(
      sync<{ square: number }>({
        waitFor: ({ type, detail }) => type === player && squares.includes(detail.square),
      }),
      sync<{ square: number }>({
        waitFor: ({ type, detail }) => type === player && squares.includes(detail.square),
      }),
      sync<{ square: number }>({
        waitFor: ({ type, detail }) => type === player && squares.includes(detail.square),
      }),
      sync<Winner>({
        request: { type: 'win', detail: { squares, player } },
      }),
    )
    return acc
  }, {})

test('detect winner', () => {
  // We create a new bProgram
  const { feedback, trigger, addThreads } = bProgram()
  // We create a new board for the game
  board = new Set(squares)
  addThreads({
    enforceTurns,
    ...squaresTaken,
    ...detectWins('X'),
    ...detectWins('O'),
  })
  let winner: Winner
  feedback({
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
  //@ts-expect-error: winner exists
  expect(winner).toEqual({ player: 'X', squares: [0, 1, 2] })
})

const stopGame = thread(sync({ waitFor: 'win' }), sync({ block: ['X', 'O'] }))

test('stop game', () => {
  // We create a new bProgram
  const { feedback, trigger, addThreads } = bProgram()
  // We create a new board for the game
  board = new Set(squares)
  addThreads({
    enforceTurns,
    ...squaresTaken,
    ...detectWins('X'),
    ...detectWins('O'),
    stopGame,
  })
  let winner: Winner
  feedback({
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
  //@ts-expect-error: winner exists
  expect(winner).toEqual({ player: 'X', squares: [0, 1, 2] })
  // O tries to take square 5 after a winner has been declared
  trigger({ type: 'O', detail: { square: 5 } })
  expect(board.has(5)).toBe(true)
})

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

test('defaultMoves', () => {
  // We create a new bProgram
  const { feedback, trigger, addThreads } = bProgram()
  // We create a new board for the game
  board = new Set(squares)
  addThreads({
    enforceTurns,
    ...squaresTaken,
    ...detectWins('X'),
    ...detectWins('O'),
    stopGame,
    ...defaultMoves,
  })
  let winner: Winner
  feedback({
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
  expect(board.has(1)).toBe(false)
})

const startAtCenter = sync({
  request: {
    type: 'O',
    detail: { square: 4 },
  },
})

test('start at center', () => {
  // We create a new bProgram
  const { feedback, trigger, addThreads } = bProgram()
  // We create a new board for the game
  board = new Set(squares)
  addThreads({
    enforceTurns,
    ...squaresTaken,
    ...detectWins('X'),
    ...detectWins('O'),
    stopGame,
    startAtCenter,
    ...defaultMoves,
  })
  let winner: Winner
  feedback({
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
  expect(board.has(4)).toBe(false)
})
const preventCompletionOfLineWithTwoXs = (board: Set<number>) => {
  const threads: Record<string, RulesFunction> = {}
  for (const win of winConditions) {
    threads[`StopXWin(${win})`] = thread(
      sync<Square>({
        waitFor: ({ type, detail }) => type === 'X' && win.includes(detail.square),
      }),
      sync<Square>({
        waitFor: ({ type, detail }) => type === 'X' && win.includes(detail.square),
      }),
      sync<Square>({
        request: () => ({ type: 'O', detail: { square: win.find((num) => board.has(num)) as number } }),
      }),
    )
  }
  return threads
}

test('prevent completion of line with two Xs', () => {
  // We create a new bProgram
  const { feedback, trigger, addThreads } = bProgram()
  // We create a new board for the game
  board = new Set(squares)
  addThreads({
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
  feedback({
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
  trigger({ type: 'X', detail: { square: 2 } })
  trigger({ type: 'X', detail: { square: 6 } })
  trigger({ type: 'X', detail: { square: 8 } })
  expect(board.has(7)).toBe(false) // O has blocked X from winning with [6, 7, 8]
  trigger({ type: 'X', detail: { square: 5 } })
  //@ts-expect-error: winner exists
  expect(winner).toEqual({ player: 'X', squares: [2, 5, 8] })
})
