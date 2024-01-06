import { Component, css, sync, loop, thread, RulesFunction } from 'plaited'
import { OMarker } from './o-marker.js'
import { XMarker } from './x-marker.js'
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

const { $stylesheet, ...cls } = css`
  .board {
    display: inline-grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(3, 1fr);
  }
  .square {
    all: unset;
    width: 44px;
    height: 44px;
    box-sizing: border-box;
    border: 1px solid transparent;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    &:nth-child(1) {
      border-right: 1px solid black;
      border-bottom: 1px solid black;
    }
    &:nth-child(2) {
      border-right: 1px solid black;
      border-bottom: 1px solid black;
    }
    &:nth-child(3) {
      border-bottom: 1px solid black;
    }
    &:nth-child(4) {
      border-right: 1px solid black;
      border-bottom: 1px solid black;
    }
    &:nth-child(5) {
      border-right: 1px solid black;
      border-bottom: 1px solid black;
    }
    &:nth-child(6) {
      border-bottom: 1px solid black;
    }
    &:nth-child(7) {
      border-right: 1px solid black;
    }
    &:nth-child(8) {
      border-right: 1px solid black;
    }
  }
`
const enforceTurns = loop(sync<Square>({ waitFor: 'X', block: 'O' }), sync<Square>({ waitFor: 'O', block: 'X' }))

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
        waitFor: ({ type, detail }) => type === 'X' && win.includes(detail.square),
      }),
      sync<Square>({
        waitFor: ({ type, detail }) => type === 'X' && win.includes(detail.square),
      }),
      sync<Square>({
        request: () => ({ type: 'O', detail: { square: win.find((num) => board.has(num)) || 0 } }),
      }),
    )
  }
  return threads
}
export const TicTacToeBoard = Component({
  tag: 'tic-tac-toe-board',
  template: (
    <div
      className={cls.board}
      stylesheet={$stylesheet}
    >
      {Array.from(Array(9).keys()).map((n) => (
        <button
          className={cls.square}
          value={n}
          bp-trigger={{ click: 'click' }}
          bp-target={`${n}`}
        ></button>
      ))}
    </div>
  ),
  bp({ feedback, $, addThreads, trigger }) {
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
    })
    feedback({
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
      click(evt: MouseEvent & { target: HTMLButtonElement }) {
        const { target } = evt
        const { value } = target
        if (value) {
          trigger({ type: 'X', detail: { square: Number(value) } })
        }
      },
    })
  },
})
