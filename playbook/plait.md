These docs will cover the following

Architecture best practices Behaviroal modules Comms module Storage module

## Exports

- plait: Class used to init a behavioral program
- selectionStrategies: callback functions (randomizedStrategy, chaosStrategy,
  priorityStrategy)
- streamEvents: constant (trigger, select, state)
- strand: function used to define a set of behavioral program rule
- loop: function used to define conditions by which a a strand rule will
  continue to execute

**Example: tic-tac-toe**

```ts
import {
  block,
  loop,
  plait,
  randomizedStrategy,
  request,
  RulesFunc,
  strand,
  waitFor,
} from 'https://deno.land/x/plaited/mod.ts'

const { trigger: xTrigger, feedback: xFeedback, add: xAdd } = plait({
  strategy: randomizedStrategy,
})

const { trigger: oTrigger, feedback: oFeedback, add: oAdd } = plait({
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
    acc[`(${square}) taken`] = strand(
      waitFor<number>({ assert: ({ data }) => square === data }),
      block<number>({ assert: ({ data }) => square === data }),
    )

    return acc
  },
  {},
)

const playerWins = (player: string) =>
  winConditions.reduce((acc: Record<string, RulesFunc>, win) => {
    acc[`${player}Wins (${win})`] = strand(
      waitFor<number>({
        assert: ({ type, data }) => type === player && win.includes(data),
      }),
      waitFor<number>({
        assert: ({ type, data }) => type === player && win.includes(data),
      }),
      waitFor<number>({
        assert: ({ type, data }) => type === player && win.includes(data),
      }),
      request({ type: `${player} Wins`, data: win }),
    )
    return acc
  }, {})

const enforceTurns = loop(
  strand(
    Object.assign(waitFor({ type: 'X' }), block({ type: 'O' })),
    Object.assign(waitFor({ type: 'O' }), block({ type: 'X' })),
  ),
)

const playerMove = (player: string) =>
  loop(
    strand({
      request: squares.map((move) => ({ type: player, data: move })),
    }),
  )

const stopGame = strand(
  waitFor({ type: 'X Wins' }, { type: 'O Wins' }),
  block({ type: 'X' }, { type: 'O' }),
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
```
