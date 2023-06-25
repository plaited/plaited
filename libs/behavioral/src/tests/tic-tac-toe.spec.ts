import { test, expect } from'@jest/globals'
import { bProgram, loop, RulesFunc, sync, thread  } from '../index.js'

const winConditions = [
  //rows
  [ 0, 1, 2 ],
  [ 3, 4, 5 ],
  [ 6, 7, 8 ],
  // columns
  [ 0, 3, 6 ],
  [ 1, 4, 7 ],
  [ 2, 5, 8 ],
  // diagonals
  [ 0, 4, 8 ],
  [ 2, 4, 6 ],
]

const squares = [ 0, 1, 2, 3, 4, 5, 6, 7, 8 ]

const playerWins = (player: 'X' | 'O') =>
  winConditions.reduce((acc: Record<string, RulesFunc>, win) => {
    acc[`${player}Wins (${win})`] = thread(
      sync<{ square: number }>({
        waitFor: {
          cb: ({ type, detail }) =>
            type === player && win.includes(detail.square),
        },
      }),
      sync<{ square: number }>({
        waitFor: {
          cb: ({ type, detail }) =>
            type === player && win.includes(detail.square),
        },
      }),
      sync<{ square: number }>({
        waitFor: {
          cb: ({ type, detail }) =>
            type === player && win.includes(detail.square),
        },
      }),
      sync<{ win: number[] }>({
        request: { type: `${player}Win`, detail: { win } },
      })
    )
    return acc
  }, {})

test('detect wins', () => {
  const  { addThreads, feedback, trigger } = bProgram()
  const actual: number[] = []
  addThreads({
    ...playerWins('X'),
  })
  feedback({
    XWin(deatil: { win: [number, number, number] }) {
      Object.assign(actual, deatil.win)
    },
  })
  trigger({ type: 'X', detail: { square: 1 } })
  trigger({ type: 'X', detail: { square: 4 } })
  trigger({ type: 'X', detail: { square: 7 } })
  expect(actual).toEqual([ 1, 4, 7 ])
})

const enforceTurns = loop([
  sync({ waitFor: { type: 'X' }, block: { type: 'O' } }),
  sync({ waitFor: { type: 'O' }, block: { type: 'X' } }),
])

test('enforceTurns', () => {
  const { addThreads, feedback, trigger } = bProgram()
  let actual: {
    player: 'X' | 'O';
    square: number;
  }
  addThreads({
    ...playerWins('O'),
    ...playerWins('X'),
    enforceTurns,
  })

  feedback({
    X({ square }: { square: number }) {
      actual = {
        player: 'X',
        square,
      }
    },
    O({ square }: { square: number }) {
      actual = {
        player: 'X',
        square,
      }
    },
  })
  trigger({ type: 'X', detail: { square: 1 } })
  trigger({ type: 'X', detail: { square: 4 } })
  trigger({ type: 'X', detail: { square: 7 } })
  expect(actual).toEqual({ player: 'X', square: 1 })
})

test('enforceTurns without blocking', () => {
  const { addThreads, feedback, trigger } = bProgram()
  let actual: {
    player: 'X' | 'O';
    win: number[];
  }

  addThreads({
    ...playerWins('O'),
    ...playerWins('X'),
    enforceTurns,
  })

  feedback({
    XWin({ win }: { win: [number, number, number] }) {
      actual = {
        player: 'X',
        win,
      }
    },
    OWin({ win }: { win: [number, number, number] }) {
      actual = {
        player: 'O',
        win,
      }
    },
  })
  trigger({ type: 'X', detail: { square: 0 } })
  trigger({ type: 'O', detail: { square: 1 } })
  trigger({ type: 'X', detail: { square: 4 } })
  trigger({ type: 'O', detail: { square: 2 } })
  trigger({ type: 'X', detail: { square: 8 } })
  //@ts-ignore: test
  expect(actual).toEqual({ player: 'X', win: [ 0, 4, 8 ] })
})

const squaresTaken = squares.reduce(
  (acc: Record<string, RulesFunc>, square) => {
    acc[`(${square}) taken`] = thread(
      sync<{ square: number }>({
        waitFor: { cb: ({ detail }) => square === detail.square },
      }),
      sync<{ square: number }>({
        block: { cb: ({ detail }) => square === detail.square },
      })
    )
    return acc
  },
  {}
)
test('squaresTaken', () => {
  const { addThreads, feedback, trigger } = bProgram()
  const actual: {
    player: 'X' | 'O';
    square: number;
  }[] = []


  addThreads({
    ...playerWins('O'),
    ...playerWins('X'),
    enforceTurns: loop([
      sync({ waitFor: { type: 'X' }, block: { type: 'O' } }),
      sync({ waitFor: { type: 'O' }, block: { type: 'X' } }),
    ]),
    ...squaresTaken,
  })
  feedback({
    O({ square }: { square: number }) {
      actual.push({
        player: 'O',
        square,
      })
    },
  })
  trigger({ type: 'X', detail: { square: 0 } })
  trigger({ type: 'O', detail: { square: 0 } }) // reuse
  trigger({ type: 'X', detail: { square: 4 } })
  trigger({ type: 'O', detail: { square: 2 } })
  trigger({ type: 'X', detail: { square: 8 } })
  //@ts-ignore: test
  expect(actual).toEqual([ { player: 'O', square: 2 } ])
})

test("doesn't stop game", () => {
  const { addThreads, feedback, trigger } = bProgram()
  const actual: (
    | { player: 'X' | 'O'; square: number }
    | { player: 'X' | 'O'; win: number[] }
  )[] = []

  addThreads({
    ...playerWins('O'),
    ...playerWins('X'),
    enforceTurns,
    ...squaresTaken,
  })
  feedback({
    X({ square }: { square: number }) {
      actual.push({
        player: 'X',
        square,
      })
    },
    O({ square }: { square: number }) {
      actual.push({
        player: 'O',
        square,
      })
    },
    XWin({ win }: { win: [number, number, number] }) {
      actual.push({
        player: 'X',
        win,
      })
    },
    OWin({ win }: { win: [number, number, number] }) {
      actual.push({
        player: 'O',
        win,
      })
    },
  })
  trigger({ type: 'X', detail: { square: 0 } })
  trigger({ type: 'O', detail: { square: 1 } })
  trigger({ type: 'X', detail: { square: 4 } })
  trigger({ type: 'O', detail: { square: 2 } })
  trigger({ type: 'X', detail: { square: 8 } })
  trigger({ type: 'O', detail: { square: 7 } })
  //@ts-ignore: test
  expect(actual).toEqual([
    { player: 'X', square: 0 },
    { player: 'O', square: 1 },
    { player: 'X', square: 4 },
    { player: 'O', square: 2 },
    { player: 'X', square: 8 },
    { player: 'X', win: [ 0, 4, 8 ] },
    { player: 'O', square: 7 },
  ])
})


const stopGame= thread(
  sync({ waitFor: [ { type: 'XWin' }, { type: 'OWin' } ] }),
  sync({ block: [ { type: 'X' }, { type: 'O' } ] })
)

test('stopGame', () => {
  const { addThreads, feedback, trigger } = bProgram()
  const actual: (
    | { player: 'X' | 'O'; square: number }
    | { player: 'X' | 'O'; win: number[] }
  )[] = []


  addThreads({
    ...playerWins('O'),
    ...playerWins('X'),
    enforceTurns,
    ...squaresTaken,
    stopGame,
  })
  feedback({
    X({ square }: { square: number }) {
      actual.push({
        player: 'X',
        square,
      })
    },
    O({ square }: { square: number }) {
      actual.push({
        player: 'O',
        square,
      })
    },
    XWin({ win }: { win: [number, number, number] }) {
      actual.push({
        player: 'X',
        win,
      })
    },
    OWin({ win }: { win: [number, number, number] }) {
      actual.push({
        player: 'O',
        win,
      })
    },
  })
  trigger({ type: 'X', detail: { square: 0 } })
  trigger({ type: 'O', detail: { square: 1 } })
  trigger({ type: 'X', detail: { square: 4 } })
  trigger({ type: 'O', detail: { square: 2 } })
  trigger({ type: 'X', detail: { square: 8 } })
  trigger({ type: 'O', detail: { square: 7 } })
  //@ts-ignore: test
  expect(actual).toEqual([
    { player: 'X', square: 0 },
    { player: 'O', square: 1 },
    { player: 'X', square: 4 },
    { player: 'O', square: 2 },
    { player: 'X', square: 8 },
    { player: 'X', win: [ 0, 4, 8 ] },
  ])
})

const defaultMoves = loop([
  sync({
    request: squares.map(square => ({
      type: 'O',
      detail: { square },
    })),
  }),
])

test('defaultMoves', () => {
  const { addThreads, feedback, trigger } = bProgram()
  const actual: (
    | { player: 'X' | 'O'; square: number }
    | { player: 'X' | 'O'; win: number[] }
  )[] = []

  addThreads({
    ...playerWins('O'),
    ...playerWins('X'),
    enforceTurns,
    ...squaresTaken,
    stopGame,
    defaultMoves,
  })
  feedback({
    X({ square }: { square: number }) {
      actual.push({
        player: 'X',
        square,
      })
    },
    O({ square }: { square: number }) {
      actual.push({
        player: 'O',
        square,
      })
    },
    XWin({ win }: { win: [number, number, number] }) {
      actual.push({
        player: 'X',
        win,
      })
    },
    OWin({ win }: { win: [number, number, number] }) {
      actual.push({
        player: 'O',
        win,
      })
    },
  })
  trigger({ type: 'X', detail: { square: 0 } })
  trigger({ type: 'X', detail: { square: 4 } })
  trigger({ type: 'X', detail: { square: 8 } })
  //@ts-ignore: test
  expect(actual).toEqual([
    { player: 'X', square: 0 },
    { player: 'O', square: 1 },
    { player: 'X', square: 4 },
    { player: 'O', square: 2 },
    { player: 'X', square: 8 },
    { player: 'X', win: [ 0, 4, 8 ] },
  ])
})

const startAtCenter = thread(
  sync({
    request: {
      type: 'O',
      detail: { square: 4 },
    },
  })
)

test('startAtCenter', () => {
  const { addThreads, feedback, trigger } = bProgram()
  const actual: (
    | { player: 'X' | 'O'; square: number }
    | { player: 'X' | 'O'; win: number[] }
  )[] = []

  addThreads({
    ...playerWins('O'),
    ...playerWins('X'),
    enforceTurns,
    ...squaresTaken,
    stopGame,
    startAtCenter,
    defaultMoves,
  })
  feedback({
    X({ square }: { square: number }) {
      actual.push({
        player: 'X',
        square,
      })
    },
    O({ square }: { square: number }) {
      actual.push({
        player: 'O',
        square,
      })
    },
    XWin({ win }: { win: [number, number, number] }) {
      actual.push({
        player: 'X',
        win,
      })
    },
    OWin({ win }: { win: [number, number, number] }) {
      actual.push({
        player: 'O',
        win,
      })
    },
  })
  trigger({ type: 'X', detail: { square: 0 } })
  trigger({ type: 'X', detail: { square: 4 } })
  trigger({ type: 'X', detail: { square: 8 } })
  //@ts-ignore: test
  expect(actual).toEqual([
    { player: 'X', square: 0 },
    { player: 'O', square: 4 },
    { player: 'X', square: 8 },
    { player: 'O', square: 1 },
  ])
})

const preventCompletionOfLineWithTwoXs = winConditions.reduce(
  (acc: Record<string, RulesFunc>, win) => {
    acc[`StopXWin(${win})`] = thread(
      sync<{ square: number }>({
        waitFor: {
          cb: ({ type, detail }) =>
            type === 'X' && win.includes(detail.square),
        },
      }),
      sync<{ square: number }>({
        waitFor: {
          cb: ({ type, detail }) =>
            type === 'X' && win.includes(detail.square),
        },
      }),
      sync<{ square: number }>({
        request: win.map(square => ({ type: 'O', detail: { square } })),
      })
    )
    return acc
  },
  {}
)

test('prevent completion of line with two Xs', () => {
  const { addThreads, feedback, trigger } = bProgram()
  const actual: (
    | { player: 'X' | 'O'; square: number }
    | { player: 'X' | 'O'; win: number[] }
  )[] = []


  addThreads({
    ...playerWins('O'),
    ...playerWins('X'),
    enforceTurns,
    ...squaresTaken,
    stopGame,
    ...preventCompletionOfLineWithTwoXs,
    startAtCenter,
    defaultMoves: loop([
      sync({
        request: squares.map(square => ({
          type: 'O',
          detail: { square },
        })),
      }),
    ]),
  })
  feedback({
    X({ square }: { square: number }) {
      actual.push({
        player: 'X',
        square,
      })
    },
    O({ square }: { square: number }) {
      actual.push({
        player: 'O',
        square,
      })
    },
    XWin({ win }: { win: [number, number, number] }) {
      actual.push({
        player: 'X',
        win,
      })
    },
    OWin({ win }: { win: [number, number, number] }) {
      actual.push({
        player: 'O',
        win,
      })
    },
  })
  trigger({ type: 'X', detail: { square: 0 } })
  trigger({ type: 'X', detail: { square: 3 } })
  //@ts-ignore: test
  expect(actual).toEqual([
    { player: 'X', square: 0 },
    { player: 'O', square: 4 },
    { player: 'X', square: 3 },
    { player: 'O', square: 6 },
  ])
})
