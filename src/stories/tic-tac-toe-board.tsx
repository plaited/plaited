import { bElement } from 'plaited'
import { bThread, bSync, type RulesFunction } from 'plaited'
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

const enforceTurns = bThread([bSync({ waitFor: 'X', block: 'O' }), bSync({ waitFor: 'O', block: 'X' })], true)

const squaresTaken: Record<string, RulesFunction> = {}
for (const square of squares) {
  squaresTaken[`(${square}) taken`] = bThread(
    [
      bSync({
        waitFor: ({ detail }) => square === detail?.square,
      }),
      bSync({
        block: ({ detail }) => square === detail?.square,
      }),
    ],
    true,
  )
}

const detectWins = (player: 'X' | 'O') =>
  winConditions.reduce((acc: Record<string, RulesFunction>, squares) => {
    acc[`${player}Wins (${squares})`] = bThread(
      [
        bSync({
          waitFor: ({ type, detail }) => type === player && squares.includes(detail.square),
        }),
        bSync({
          waitFor: ({ type, detail }) => type === player && squares.includes(detail.square),
        }),
        bSync({
          waitFor: ({ type, detail }) => type === player && squares.includes(detail.square),
        }),
        bSync({
          request: { type: 'win', detail: { squares, player } },
        }),
      ],
      true,
    )
    return acc
  }, {})

const stopGame = bThread([bSync({ waitFor: 'win' }), bSync({ block: ['X', 'O'] })], true)

const defaultMoves: Record<string, RulesFunction> = {}
for (const square of squares) {
  defaultMoves[`defaultMoves(${square})`] = bThread(
    [
      bSync({
        request: {
          type: 'O',
          detail: { square },
        },
      }),
    ],
    true,
  )
}

const startAtCenter = bSync({
  request: {
    type: 'O',
    detail: { square: 4 },
  },
})

const preventCompletionOfLineWithTwoXs = (board: Set<number>) => {
  const threads: Record<string, RulesFunction> = {}
  for (const win of winConditions) {
    threads[`StopXWin(${win})`] = bThread([
      bSync({
        waitFor: ({ type, detail }) => type === 'X' && win.includes(detail.square),
      }),
      bSync({
        waitFor: ({ type, detail }) => type === 'X' && win.includes(detail.square),
      }),
      bSync({
        request: () => ({ type: 'O', detail: { square: win.find((num) => board.has(num)) || 0 } }),
      }),
    ])
  }
  return threads
}
export const TicTacToeBoard = bElement({
  tag: 'tic-tac-toe-board',
  shadowDom: <BoardMarker />,
  bProgram({ $, bThreads, trigger }) {
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
