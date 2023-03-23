import { assertEquals } from '../../dev-deps.ts'
import { bProgram, RulesFunc } from '../mod.ts'

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

Deno.test('detect wins', () => {
  const { sync, addThreads, thread, feedback, trigger } = bProgram()
  const actual: number[] = []
  const playerWins = (player: string) =>
    winConditions.reduce((acc: Record<string, RulesFunc>, win) => {
      acc[`${player}Wins (${win})`] = thread(
        sync<{ square: number }>({
          waitFor: {
            cb: ({ event, detail }) =>
              event === player && win.includes(detail.square),
          },
        }),
        sync<{ square: number }>({
          waitFor: {
            cb: ({ event, detail }) =>
              event === player && win.includes(detail.square),
          },
        }),
        sync<{ square: number }>({
          waitFor: {
            cb: ({ event, detail }) =>
              event === player && win.includes(detail.square),
          },
        }),
        sync<{ win: number[] }>({
          request: { event: `${player}Win`, detail: { win } },
        }),
      )
      return acc
    }, {})
  addThreads({
    ...playerWins('X'),
  })
  feedback({
    XWin(deatil: { win: [number, number, number] }) {
      Object.assign(actual, deatil.win)
    },
  })
  trigger({ event: 'X', detail: { square: 1 } })
  trigger({ event: 'X', detail: { square: 4 } })
  trigger({ event: 'X', detail: { square: 7 } })
  assertEquals(actual, [1, 4, 7])
})

Deno.test('enforceTurns', () => {
  const { sync, addThreads, thread, feedback, trigger, loop } = bProgram()
  let actual: {
    player: 'X' | 'O'
    square: number
  }
  const playerWins = (player: string) =>
    winConditions.reduce((acc: Record<string, RulesFunc>, win) => {
      acc[`${player}Wins (${win})`] = thread(
        sync<{ square: number }>({
          waitFor: {
            cb: ({ event, detail }) =>
              event === player && win.includes(detail.square),
          },
        }),
        sync<{ square: number }>({
          waitFor: {
            cb: ({ event, detail }) =>
              event === player && win.includes(detail.square),
          },
        }),
        sync<{ square: number }>({
          waitFor: {
            cb: ({ event, detail }) =>
              event === player && win.includes(detail.square),
          },
        }),
        sync<{ win: number[] }>({
          request: { event: `${player}Win`, detail: { win } },
        }),
      )
      return acc
    }, {})

  addThreads({
    ...playerWins('O'),
    ...playerWins('X'),
    enforceTurns: loop([
      sync({ waitFor: { event: 'X' }, block: { event: 'O' } }),
      sync({ waitFor: { event: 'O' }, block: { event: 'X' } }),
    ]),
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
  trigger({ event: 'X', detail: { square: 1 } })
  trigger({ event: 'X', detail: { square: 4 } })
  trigger({ event: 'X', detail: { square: 7 } })
  //@ts-ignore: test
  assertEquals(actual, { player: 'X', square: 1 })
})

Deno.test('enforceTurns without blocking', () => {
  const { sync, addThreads, thread, feedback, trigger, loop } = bProgram()
  let actual: {
    player: 'X' | 'O'
    win: number[]
  }
  const playerWins = (player: string) =>
    winConditions.reduce((acc: Record<string, RulesFunc>, win) => {
      acc[`${player}Wins (${win})`] = thread(
        sync<{ square: number }>({
          waitFor: {
            cb: ({ event, detail }) =>
              event === player && win.includes(detail.square),
          },
        }),
        sync<{ square: number }>({
          waitFor: {
            cb: ({ event, detail }) =>
              event === player && win.includes(detail.square),
          },
        }),
        sync<{ square: number }>({
          waitFor: {
            cb: ({ event, detail }) =>
              event === player && win.includes(detail.square),
          },
        }),
        sync<{ win: number[] }>({
          request: { event: `${player}Win`, detail: { win } },
        }),
      )
      return acc
    }, {})

  addThreads({
    ...playerWins('O'),
    ...playerWins('X'),
    enforceTurns: loop([
      sync({ waitFor: { event: 'X' }, block: { event: 'O' } }),
      sync({ waitFor: { event: 'O' }, block: { event: 'X' } }),
    ]),
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
  trigger({ event: 'X', detail: { square: 0 } })
  trigger({ event: 'O', detail: { square: 1 } })
  trigger({ event: 'X', detail: { square: 4 } })
  trigger({ event: 'O', detail: { square: 2 } })
  trigger({ event: 'X', detail: { square: 8 } })
  //@ts-ignore: test
  assertEquals(actual, { player: 'X', win: [0, 4, 8] })
})

Deno.test('squaresTaken', () => {
  const { sync, addThreads, thread, feedback, trigger, loop } = bProgram()
  const actual: {
    player: 'X' | 'O'
    square: number
  }[] = []
  const playerWins = (player: string) =>
    winConditions.reduce((acc: Record<string, RulesFunc>, win) => {
      acc[`${player}Wins (${win})`] = thread(
        sync<{ square: number }>({
          waitFor: {
            cb: ({ event, detail }) =>
              event === player && win.includes(detail.square),
          },
        }),
        sync<{ square: number }>({
          waitFor: {
            cb: ({ event, detail }) =>
              event === player && win.includes(detail.square),
          },
        }),
        sync<{ square: number }>({
          waitFor: {
            cb: ({ event, detail }) =>
              event === player && win.includes(detail.square),
          },
        }),
        sync<{ win: number[] }>({
          request: { event: `${player}Win`, detail: { win } },
        }),
      )
      return acc
    }, {})
  const squaresTaken = squares.reduce(
    (acc: Record<string, RulesFunc>, square) => {
      acc[`(${square}) taken`] = thread(
        sync<{ square: number }>({
          waitFor: { cb: ({ detail }) => square === detail.square },
        }),
        sync<{ square: number }>({
          block: { cb: ({ detail }) => square === detail.square },
        }),
      )
      return acc
    },
    {},
  )

  addThreads({
    ...playerWins('O'),
    ...playerWins('X'),
    enforceTurns: loop([
      sync({ waitFor: { event: 'X' }, block: { event: 'O' } }),
      sync({ waitFor: { event: 'O' }, block: { event: 'X' } }),
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
  trigger({ event: 'X', detail: { square: 0 } })
  trigger({ event: 'O', detail: { square: 0 } }) // reuse
  trigger({ event: 'X', detail: { square: 4 } })
  trigger({ event: 'O', detail: { square: 2 } })
  trigger({ event: 'X', detail: { square: 8 } })
  //@ts-ignore: test
  assertEquals(actual, [{ player: 'O', square: 2 }])
})

Deno.test('doesn\'t stop game', () => {
  const { sync, addThreads, thread, feedback, trigger, loop } = bProgram()
  const actual: (
    | { player: 'X' | 'O'; square: number }
    | { player: 'X' | 'O'; win: number[] }
  )[] = []
  const playerWins = (player: string) =>
    winConditions.reduce((acc: Record<string, RulesFunc>, win) => {
      acc[`${player}Wins (${win})`] = thread(
        sync<{ square: number }>({
          waitFor: {
            cb: ({ event, detail }) =>
              event === player && win.includes(detail.square),
          },
        }),
        sync<{ square: number }>({
          waitFor: {
            cb: ({ event, detail }) =>
              event === player && win.includes(detail.square),
          },
        }),
        sync<{ square: number }>({
          waitFor: {
            cb: ({ event, detail }) =>
              event === player && win.includes(detail.square),
          },
        }),
        sync<{ win: number[] }>({
          request: { event: `${player}Win`, detail: { win } },
        }),
      )
      return acc
    }, {})
  const squaresTaken = squares.reduce(
    (acc: Record<string, RulesFunc>, square) => {
      acc[`(${square}) taken`] = thread(
        sync<{ square: number }>({
          waitFor: { cb: ({ detail }) => square === detail.square },
        }),
        sync<{ square: number }>({
          block: { cb: ({ detail }) => square === detail.square },
        }),
      )
      return acc
    },
    {},
  )

  addThreads({
    ...playerWins('O'),
    ...playerWins('X'),
    enforceTurns: loop([
      sync({ waitFor: { event: 'X' }, block: { event: 'O' } }),
      sync({ waitFor: { event: 'O' }, block: { event: 'X' } }),
    ]),
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
  trigger({ event: 'X', detail: { square: 0 } })
  trigger({ event: 'O', detail: { square: 1 } })
  trigger({ event: 'X', detail: { square: 4 } })
  trigger({ event: 'O', detail: { square: 2 } })
  trigger({ event: 'X', detail: { square: 8 } })
  trigger({ event: 'O', detail: { square: 7 } })
  //@ts-ignore: test
  assertEquals(actual, [
    { player: 'X', square: 0 },
    { player: 'O', square: 1 },
    { player: 'X', square: 4 },
    { player: 'O', square: 2 },
    { player: 'X', square: 8 },
    { player: 'X', win: [0, 4, 8] },
    { player: 'O', square: 7 },
  ])
})

Deno.test('stopGame', () => {
  const { sync, addThreads, thread, feedback, trigger, loop } = bProgram()
  const actual: (
    | { player: 'X' | 'O'; square: number }
    | { player: 'X' | 'O'; win: number[] }
  )[] = []
  const playerWins = (player: string) =>
    winConditions.reduce((acc: Record<string, RulesFunc>, win) => {
      acc[`${player}Wins (${win})`] = thread(
        sync<{ square: number }>({
          waitFor: {
            cb: ({ event, detail }) =>
              event === player && win.includes(detail.square),
          },
        }),
        sync<{ square: number }>({
          waitFor: {
            cb: ({ event, detail }) =>
              event === player && win.includes(detail.square),
          },
        }),
        sync<{ square: number }>({
          waitFor: {
            cb: ({ event, detail }) =>
              event === player && win.includes(detail.square),
          },
        }),
        sync<{ win: number[] }>({
          request: { event: `${player}Win`, detail: { win } },
        }),
      )
      return acc
    }, {})
  const squaresTaken = squares.reduce(
    (acc: Record<string, RulesFunc>, square) => {
      acc[`(${square}) taken`] = thread(
        sync<{ square: number }>({
          waitFor: { cb: ({ detail }) => square === detail.square },
        }),
        sync<{ square: number }>({
          block: { cb: ({ detail }) => square === detail.square },
        }),
      )
      return acc
    },
    {},
  )

  addThreads({
    ...playerWins('O'),
    ...playerWins('X'),
    enforceTurns: loop([
      sync({ waitFor: { event: 'X' }, block: { event: 'O' } }),
      sync({ waitFor: { event: 'O' }, block: { event: 'X' } }),
    ]),
    ...squaresTaken,
    stopGame: thread(
      sync({ waitFor: [{ event: 'XWin' }, { event: 'OWin' }] }),
      sync({ block: [{ event: 'X' }, { event: 'O' }] }),
    ),
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
  trigger({ event: 'X', detail: { square: 0 } })
  trigger({ event: 'O', detail: { square: 1 } })
  trigger({ event: 'X', detail: { square: 4 } })
  trigger({ event: 'O', detail: { square: 2 } })
  trigger({ event: 'X', detail: { square: 8 } })
  trigger({ event: 'O', detail: { square: 7 } })
  //@ts-ignore: test
  assertEquals(actual, [
    { player: 'X', square: 0 },
    { player: 'O', square: 1 },
    { player: 'X', square: 4 },
    { player: 'O', square: 2 },
    { player: 'X', square: 8 },
    { player: 'X', win: [0, 4, 8] },
  ])
})

Deno.test('defaultMoves', () => {
  const { sync, addThreads, thread, feedback, trigger, loop } = bProgram()
  const actual: (
    | { player: 'X' | 'O'; square: number }
    | { player: 'X' | 'O'; win: number[] }
  )[] = []
  const playerWins = (player: string) =>
    winConditions.reduce((acc: Record<string, RulesFunc>, win) => {
      acc[`${player}Wins (${win})`] = thread(
        sync<{ square: number }>({
          waitFor: {
            cb: ({ event, detail }) =>
              event === player && win.includes(detail.square),
          },
        }),
        sync<{ square: number }>({
          waitFor: {
            cb: ({ event, detail }) =>
              event === player && win.includes(detail.square),
          },
        }),
        sync<{ square: number }>({
          waitFor: {
            cb: ({ event, detail }) =>
              event === player && win.includes(detail.square),
          },
        }),
        sync<{ win: number[] }>({
          request: { event: `${player}Win`, detail: { win } },
        }),
      )
      return acc
    }, {})
  const squaresTaken = squares.reduce(
    (acc: Record<string, RulesFunc>, square) => {
      acc[`(${square}) taken`] = thread(
        sync<{ square: number }>({
          waitFor: { cb: ({ detail }) => square === detail.square },
        }),
        sync<{ square: number }>({
          block: { cb: ({ detail }) => square === detail.square },
        }),
      )
      return acc
    },
    {},
  )

  addThreads({
    ...playerWins('O'),
    ...playerWins('X'),
    enforceTurns: loop([
      sync({ waitFor: { event: 'X' }, block: { event: 'O' } }),
      sync({ waitFor: { event: 'O' }, block: { event: 'X' } }),
    ]),
    ...squaresTaken,
    stopGame: thread(
      sync({ waitFor: [{ event: 'XWin' }, { event: 'OWin' }] }),
      sync({ block: [{ event: 'X' }, { event: 'O' }] }),
    ),
    defaultMoves: loop([
      sync({
        request: squares.map((square) => ({
          event: 'O',
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
  trigger({ event: 'X', detail: { square: 0 } })
  trigger({ event: 'X', detail: { square: 4 } })
  trigger({ event: 'X', detail: { square: 8 } })
  //@ts-ignore: test
  assertEquals(actual, [
    { player: 'X', square: 0 },
    { player: 'O', square: 1 },
    { player: 'X', square: 4 },
    { player: 'O', square: 2 },
    { player: 'X', square: 8 },
    { player: 'X', win: [0, 4, 8] },
  ])
})

Deno.test('startAtCenter', () => {
  const { sync, addThreads, thread, feedback, trigger, loop } = bProgram()
  const actual: (
    | { player: 'X' | 'O'; square: number }
    | { player: 'X' | 'O'; win: number[] }
  )[] = []
  const playerWins = (player: string) =>
    winConditions.reduce((acc: Record<string, RulesFunc>, win) => {
      acc[`${player}Wins (${win})`] = thread(
        sync<{ square: number }>({
          waitFor: {
            cb: ({ event, detail }) =>
              event === player && win.includes(detail.square),
          },
        }),
        sync<{ square: number }>({
          waitFor: {
            cb: ({ event, detail }) =>
              event === player && win.includes(detail.square),
          },
        }),
        sync<{ square: number }>({
          waitFor: {
            cb: ({ event, detail }) =>
              event === player && win.includes(detail.square),
          },
        }),
        sync<{ win: number[] }>({
          request: { event: `${player}Win`, detail: { win } },
        }),
      )
      return acc
    }, {})
  const squaresTaken = squares.reduce(
    (acc: Record<string, RulesFunc>, square) => {
      acc[`(${square}) taken`] = thread(
        sync<{ square: number }>({
          waitFor: { cb: ({ detail }) => square === detail.square },
        }),
        sync<{ square: number }>({
          block: { cb: ({ detail }) => square === detail.square },
        }),
      )
      return acc
    },
    {},
  )

  addThreads({
    ...playerWins('O'),
    ...playerWins('X'),
    enforceTurns: loop([
      sync({ waitFor: { event: 'X' }, block: { event: 'O' } }),
      sync({ waitFor: { event: 'O' }, block: { event: 'X' } }),
    ]),
    ...squaresTaken,
    stopGame: thread(
      sync({ waitFor: [{ event: 'XWin' }, { event: 'OWin' }] }),
      sync({ block: [{ event: 'X' }, { event: 'O' }] }),
    ),
    startAtCenter: thread(
      sync({
        request: {
          event: 'O',
          detail: { square: 4 },
        },
      }),
    ),
    defaultMoves: loop([
      sync({
        request: squares.map((square) => ({
          event: 'O',
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
  trigger({ event: 'X', detail: { square: 0 } })
  trigger({ event: 'X', detail: { square: 4 } })
  trigger({ event: 'X', detail: { square: 8 } })
  //@ts-ignore: test
  assertEquals(actual, [
    { player: 'X', square: 0 },
    { player: 'O', square: 4 },
    { player: 'X', square: 8 },
    { player: 'O', square: 1 },
  ])
})

Deno.test('preventCompletionOfLineWithTwoXs', () => {
  const { sync, addThreads, thread, feedback, trigger, loop } = bProgram()
  const actual: (
    | { player: 'X' | 'O'; square: number }
    | { player: 'X' | 'O'; win: number[] }
  )[] = []
  const playerWins = (player: string) =>
    winConditions.reduce((acc: Record<string, RulesFunc>, win) => {
      acc[`${player}Wins (${win})`] = thread(
        sync<{ square: number }>({
          waitFor: {
            cb: ({ event, detail }) =>
              event === player && win.includes(detail.square),
          },
        }),
        sync<{ square: number }>({
          waitFor: {
            cb: ({ event, detail }) =>
              event === player && win.includes(detail.square),
          },
        }),
        sync<{ square: number }>({
          waitFor: {
            cb: ({ event, detail }) =>
              event === player && win.includes(detail.square),
          },
        }),
        sync<{ win: number[] }>({
          request: { event: `${player}Win`, detail: { win } },
        }),
      )
      return acc
    }, {})
  const squaresTaken = squares.reduce(
    (acc: Record<string, RulesFunc>, square) => {
      acc[`(${square}) taken`] = thread(
        sync<{ square: number }>({
          waitFor: { cb: ({ detail }) => square === detail.square },
        }),
        sync<{ square: number }>({
          block: { cb: ({ detail }) => square === detail.square },
        }),
      )
      return acc
    },
    {},
  )

  const preventCompletionOfLineWithTwoXs = winConditions.reduce(
    (acc: Record<string, RulesFunc>, win) => {
      acc[`StopXWin(${win})`] = thread(
        sync<{ square: number }>({
          waitFor: {
            cb: ({ event, detail }) =>
              event === 'X' && win.includes(detail.square),
          },
        }),
        sync<{ square: number }>({
          waitFor: {
            cb: ({ event, detail }) =>
              event === 'X' && win.includes(detail.square),
          },
        }),
        sync<{ square: number }>({
          request: win.map((square) => ({ event: 'O', detail: { square } })),
        }),
      )
      return acc
    },
    {},
  )
  addThreads({
    ...playerWins('O'),
    ...playerWins('X'),
    enforceTurns: loop([
      sync({ waitFor: { event: 'X' }, block: { event: 'O' } }),
      sync({ waitFor: { event: 'O' }, block: { event: 'X' } }),
    ]),
    ...squaresTaken,
    stopGame: thread(
      sync({ waitFor: [{ event: 'XWin' }, { event: 'OWin' }] }),
      sync({ block: [{ event: 'X' }, { event: 'O' }] }),
    ),
    ...preventCompletionOfLineWithTwoXs,
    startAtCenter: thread(
      sync({
        request: {
          event: 'O',
          detail: { square: 4 },
        },
      }),
    ),
    defaultMoves: loop([
      sync({
        request: squares.map((square) => ({
          event: 'O',
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
  trigger({ event: 'X', detail: { square: 0 } })
  trigger({ event: 'X', detail: { square: 3 } })
  //@ts-ignore: test
  assertEquals(actual, [
    { player: 'X', square: 0 },
    { player: 'O', square: 4 },
    { player: 'X', square: 3 },
    { player: 'O', square: 6 },
  ])
})
