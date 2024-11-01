# Putting it together

So we've created some rules for our game and a set of user interface elements. Next we'll put it all together.

```ts
// import plaited
import { Component, css, sync, loop, thread, RulesFunction } from 'plaited'

// import our UI components
import { OMarker } from './o-marker.js'
import { XMarker } from './x-marker.js'
import { BoardMarker } from './board-marker.js'

// Set our win conditions
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

// Set our squares
const squares = [0, 1, 2, 3, 4, 5, 6, 7, 8]

// Define the types
type Square = { square: number }
type Winner = { player: 'X' | 'O'; squares: number[] }

// Define our rules
// These are the same as those established in 01
const enforceTurns = loop(sync<Square>({ waitFor: 'X', block: 'O' }), sync<Square>({ waitFor: 'O', block: 'X' }))
const stopGame = thread(sync({ waitFor: 'win' }), sync({ block: ['X', 'O'] }))
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
const defaultMoves: Record<string, RulesFunction> = {}
const squaresTaken: Record<string, RulesFunction> = {}
for (const square of squares) {
  defaultMoves[`defaultMoves(${square})`] = loop(
    sync<Square>({
      request: {
        type: 'O',
        detail: { square },
      },
    }),
  )

  squaresTaken[`(${square}) taken`] = thread(
    sync<Square>({
      waitFor: ({ detail }) => square === detail.square,
    }),
    sync<Square>({
      block: ({ detail }) => square === detail.square,
    }),
  )
}


// Then create the TicTacToeBoard
// These are the same as those established in 02
export const TicTacToeBoard = Component({
  tag: 'tic-tac-toe-board',
  template: <BoardMarker />,
  bProgram({ feedback, $, addThreads, trigger }) {
    const board = new Set(squares)
    addThreads({
      // Add all our rules as bProgram threads
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
      // When BPEvent X happens we delete the square provided in the event's detail then render an XMarker at that square
      X({ square }: Square) {
        board.delete(square)
        $(`${square}`)[0]?.render(<XMarker />)
      },
      // When BPEvent X happens we delete the square provided in the event's detail then render an XMarker at that square
      O({ square }: Square) {
        board.delete(square)
        $(`${square}`)[0]?.render(<OMarker />)
      },
      // When BPEvent click happens we'll capture the mouse event and target element then trigger an 'X' event and pass it the button value
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
```
