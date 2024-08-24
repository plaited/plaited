import { defineTemplate, RulesFunction, sync, point } from 'plaited'
import { OMarker } from './o-marker.js'
import { XMarker } from './x-marker.js'
import { BoardMarker } from './board-marker.js'

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

const enforceTurns = sync([
  point<Square>({ waitFor: 'X', block: 'O' }),
  point<Square>({ waitFor: 'O', block: 'X' })
], true)

const squaresTaken: Record<string, RulesFunction> = {}
for (const square of squares) {
  squaresTaken[`(${square}) taken`] = sync([
    point<Square>({
      waitFor: ({ detail }) => square === detail.square,
    }),
    point<Square>({
      block: ({ detail }) => square === detail.square,
    }),
  ], true)
}

type Winner = { player: 'X' | 'O'; squares: number[] }
const detectWins = (player: 'X' | 'O') =>
  winConditions.reduce((acc: Record<string, RulesFunction>, squares) => {
    acc[`${player}Wins (${squares})`] = sync([
      point<{ square: number }>({
        waitFor: ({ type, detail }) => type === player && squares.includes(detail.square),
      }),
      point<{ square: number }>({
        waitFor: ({ type, detail }) => type === player && squares.includes(detail.square),
      }),
      point<{ square: number }>({
        waitFor: ({ type, detail }) => type === player && squares.includes(detail.square),
      }),
      point<Winner>({
        request: { type: 'win', detail: { squares, player } },
      }),
    ], true)
    return acc
  }, {})

const stopGame = sync([
  point({ waitFor: 'win' }),
  point({ block: ['X', 'O'] })
], true)

const defaultMoves: Record<string, RulesFunction> = {}
for (const square of squares) {
  defaultMoves[`defaultMoves(${square})`] = sync([
    point<Square>({
      request: {
        type: 'O',
        detail: { square },
      },
    }),
  ], true)
}

const startAtCenter = point({
  request: {
    type: 'O',
    detail: { square: 4 },
  },
})

const preventCompletionOfLineWithTwoXs = (board: Set<number>) => {
  const threads: Record<string, RulesFunction> = {}
  for (const win of winConditions) {
    threads[`StopXWin(${win})`] = sync([
      point<Square>({
        waitFor: ({ type, detail }) => type === 'X' && win.includes(detail.square),
      }),
      point<Square>({
        waitFor: ({ type, detail }) => type === 'X' && win.includes(detail.square),
      }),
      point<Square>({
        request: () => ({ type: 'O', detail: { square: win.find((num) => board.has(num)) || 0 } }),
      }),
    ])
  }
  return threads
}
export const TicTacToeBoard = defineTemplate({
  tag: 'tic-tac-toe-board',
  shadowDom: <BoardMarker />,
  connectedCallback({ $, bThreads, trigger }) {
    const board = new Set(squares)
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
    return {
      // When BPEvent X happens we delete the square provided in the event's detail
      X({ square }: Square) {
        board.delete(square)
        $(`${square}`)[0]?.render(<XMarker />)
      },
      // When BPEvent X happens we delete the square provided in the event's detail
      O({ square }: Square) {
        board.delete(square)
        $(`${square}`)[0]?.render(<OMarker />)
      },
      // When BPEvent click happens
      click(evt: MouseEvent & { target: HTMLButtonElement }) {
        const { target } = evt
        const { value } = target
        if (value) {
          trigger({ type: 'X', detail: { square: Number(value) } })
        }
      },
    }
  },
})
