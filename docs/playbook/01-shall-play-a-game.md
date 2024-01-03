> That’s because we misunderstand play itself, casting it as exuberant, silly, a frippery that signals to us that our children are still young enough to have not yet turned their minds to more weighty endeavours. But play is serious. Play is absolute. Play is the complete absorption in something that doesn’t matter to the external world, but which matters completely to you. It’s an immersion in your own interests that becomes a feeling in itself, a potent emotion. Play is a disappearance into a space of our choosing, invisible to those outside the game. It is the pursuit of pure flow, a sandbox mind in which we can test new thoughts, new selves. It’s a form of symbolic living, a way to transpose one reality onto another and mine it for meaning. Play is a form of enchantment.”
> ― Katherine May, Enchantment: Awakening Wonder in an Anxious Age

# Shall we play a game?

The game is tic-tac-toe. While it may seem counter intuitive for a UI library we won't be starting with the UI. In fact maybe we should leave it as an [afterthought](https://michel.codes/blogs/ui-as-an-afterthought) for the time being. 

Let's create program to orchestrate our game. For this we'll be using the behavioral programming
algorithm via a function that serves as the reactive foundation for everything Plaited, `bProgram`.
Calling this function allows us to instantiate a behavioral program for our game. Behavioral Programming.

```ts
import { bProgram, loop, RulesFunc, sync, thread } from 'plaited'
const { addThreads, feedback, trigger } = bProgram()
```

Let's start with a the board and we'll use an array to represent all of the `squares`.

```ts
const squares = [
  0, 1, 2,
  3, 4, 5,
  6, 7, 8
]
```

Next up let's create an array to hold our win conditions for our game

```ts
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
```

Now we will create our player's win detection threads using a function. The function `playerWins` takes the player `X` or `O` and returns our threads by using reduce to iterate over the `winConditions`, thus creating threads to detect when a player has won.

```ts
const playerWins = (player: 'X' | 'O') =>
  winConditions.reduce((acc: Record<string, RulesFunc>, win) => {
    acc[`${player}Wins (${win})`] = thread(
      sync<{ square: number }>({
        waitFor: ({ type, detail }) => type === player && win.includes(detail.square),
      }),
      sync<{ square: number }>({
        waitFor: ({ type, detail }) => type === player && win.includes(detail.square),
      }),
      sync<{ square: number }>({
        waitFor: ({ type, detail }) => type === player && win.includes(detail.square),
      }),
      sync<{ win: number[] }>({
        request: { type: `${player}Win`, detail: { win } },
      }),
    )
    return acc
  }, {})
```

However, in this scenario, `X` is playing all by itself and not waiting for `O`. Let's teach our program how to take turns.

We'll add a new thread, `enforceTurns`, which loops between two sync statements `onlyXCanGo` and `onlyOCanGo`. Only one of these statements can be enforced at any one time. This enforces the rule of the game that they take turns until someone wins.

```ts
const onlyXCanGo = sync({ waitFor: 'X', block: 'O' })
const onlyOCanGo = sync({ waitFor: 'O', block: 'X' })

const enforceTurns = loop([onlyXCanGo, onlyOCanGo])

test('enforceTurns', () => {
  const { addThreads, feedback, trigger } = bProgram()
  let actual: {
    player: 'X' | 'O'
    square: number
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
```

So in the test above test `X` takes it's first turn but after playing square `1` it can't make any more moves until `O` takes a turn. Therefore, no matter how many times `X` triggers another move. The game will only recognize it's actual move as square `1`.

But right now there is nothing stopping `O` from also playing a move on `1`. Let's create a new function to add threads preventing players from making moves on squares that are already taken.

Using the same approach we took with `playerWins`, we'll iterate over the `squares` to create threads for all `squaresTaken`.

```ts
const squaresTaken = squares.reduce((acc: Record<string, RulesFunc>, square) => {
  acc[`(${square}) taken`] = thread(
    sync<{ square: number }>({
      waitFor:  ({ detail }) => square === detail.square ,
    }),
    sync<{ square: number }>({
      block:  ({ detail }) => square === detail.square ,
    }),
  )
  return acc
}, {})

test('squaresTaken', () => {
  const { addThreads, feedback, trigger } = bProgram()
  const actual: {
    player: 'X' | 'O'
    square: number
  }[] = []

  addThreads({
    ...playerWins('O'),
    ...playerWins('X'),
    enforceTurns: loop([
      sync({ waitFor:  'X', block:  'O' }),
      sync({ waitFor:  'O', block:  'X' }),
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
  trigger({ type: 'O', detail: { square: 0 } })
  expect(actual).toEqual([])
})
```

Now each square may only be called by players once. After that, all other moves on that square are blocked.

`X` and `O` will now take turns and no more than one player will be able to make a move on any one square. But once a player wins, the game needs to end. Wait for one of the win events with `XWin` or `OWin`, then block any future moves by either player.

```ts
const stopGame = thread(sync({ waitFor: ['XWin', 'OWin'] }), sync({ block: ['X', 'O'] }))

test('stopGame', () => {
  const { addThreads, feedback, trigger } = bProgram()
  const board = new Set([...squares]);
  let actual: ({ player: 'X' | 'O'; win: number[] })
  
  addThreads({
    ...playerWins('O'),
    ...playerWins('X'),
    enforceTurns,
    ...squaresTaken,
    stopGame,
  })
  feedback({
    X({ square }: { square: number }) {
      board.delete(square);
    },
    O({ square }: { square: number }) {
      board.delete(square);
    },
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
  trigger({ type: 'O', detail: { square: 7 } })
  expect(actual).toEqual({ player: 'X', win: [0, 4, 8] })
  expect(board.has(7)).toBe(true);
})
```

So far every player move has to be manually triggered. We'll add a set of `defaultMoves`. For every square we define a default move event for `O`. This enables the app to take on the role of `O`. Making this a one player game.

**Note** This is when the order of events in a bProgram really starts to matter. The first square will have a greater priority than the last square. The only exception being if that square has already been taken by a player and future moves blocked by our `squaresTaken` threads.

```ts
const defaultMoves = squares.reduce((threads, square) => {
  threads[`defaultMoves(${square})`] = loop([
    sync({
      request: {
        type: 'O',
        detail: { square },
      },
    }),
  ])
  return threads
}, {})

test('defaultMoves', () => {
  const { addThreads, feedback, trigger } = bProgram()
  const actual: ({ player: 'X' | 'O'; square: number } | { player: 'X' | 'O'; win: number[] })[] = []

  addThreads({
    ...playerWins('O'),
    ...playerWins('X'),
    enforceTurns,
    ...squaresTaken,
    stopGame,
    ...defaultMoves,
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
  expect(actual).toEqual([
    { player: 'X', square: 0 },
    { player: 'O', square: 1 },
    { player: 'X', square: 4 },
    { player: 'O', square: 2 },
    { player: 'X', square: 8 },
    { player: 'X', win: [0, 4, 8] },
  ])
})
```

But a computer player that always plays from `0` to `8` is boring. Let's make it more strategic in it's play. Add a `startAtCenter` function. Make sure `startAtCenter` is above `defaultMoves` in the `addThreads` method. This will give `startAtCenter` a higher priority when an event is requested.

```ts
const startAtCenter = thread(
  sync({
    request: {
      type: 'O',
      detail: { square: 4 },
    },
  }),
)

test('startAtCenter', () => {
  const { addThreads, feedback, trigger } = bProgram()
  const actual: ({ player: 'X' | 'O'; square: number } | { player: 'X' | 'O'; win: number[] })[] = []

  addThreads({
    ...playerWins('O'),
    ...playerWins('X'),
    enforceTurns,
    ...squaresTaken,
    stopGame,
    startAtCenter,
    ...defaultMoves,
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
  })
  trigger({ type: 'X', detail: { square: 0 } })
  trigger({ type: 'X', detail: { square: 4 } })
  trigger({ type: 'X', detail: { square: 8 } })
  expect(actual).toEqual([
    { player: 'X', square: 0 },
    { player: 'O', square: 4 },
    { player: 'X', square: 8 },
    { player: 'O', square: 1 },
  ])
})
```

If `O` was really a good player, it would also try to stop it's opponent from winning. Add `preventXFromCompletingALine` so that the program will try to prevent the completion of a line with two squares already taken. This must come before `startAtCenter` so the program will always check if `X` has already taken two squares in a line.

```ts
test('prevent completion of line with two Xs', () => {
  const board = new Set(squares)
  const { addThreads, feedback, trigger } = bProgram()
  const actual: ({ player: 'X' | 'O'; square: number } | { player: 'X' | 'O'; win: number[] })[] = []

  const preventXFromCompletingALine = winConditions.reduce((acc: Record<string, RulesFunc>, win) => {
    acc[`StopXWin(${win})`] = thread(
      sync<{ square: number }>({
        waitFor: ({ type, detail }) => type === 'X' && win.includes(detail.square),
      }),
      sync<{ square: number }>({
        waitFor: ({ type, detail }) => type === 'X' && win.includes(detail.square),
      }),
      sync<{ square: number }>({
        request: () => ({ type: 'O', detail: { square: win.find((num) => board.has(num)) } }),
      }),
    )
    return acc
  }, {})
  addThreads({
    ...playerWins('O'),
    ...playerWins('X'),
    enforceTurns,
    ...squaresTaken,
    stopGame,
    ...preventCompletionOfLineWithTwoXs,
    startAtCenter,
    ...defaultMoves,
  })
  feedback({
    X({ square }: { square: number }) {
      actual.push({
        player: 'X',
        square,
      })
      board.delete(square)
    },
    O({ square }: { square: number }) {
      actual.push({
        player: 'O',
        square,
      })
      board.delete(square)
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
```

So there is the working implementation for a bProgram tic-tac-toe app. Let's see a full game play out.

```ts
test('Game 1', () => {
  const board = new Set(squares)
  const { addThreads, feedback, trigger } = bProgram()
  const actual: ({ player: 'X' | 'O'; win: number[] })

  addThreads({
    ...playerWins('O'),
    ...playerWins('X'),
    enforceTurns,
    ...squaresTaken,
    stopGame,
    ...preventCompletionOfLineWithTwoXs,
    startAtCenter,
    ...defaultMoves,
  })
  feedback({
    X({ square }: { square: number }) {
      board.delete(square)
    },
    O({ square }: { square: number }) {
      board.delete(square)
    },
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
  trigger({ type: 'X', detail: { square: 5 } })
  trigger({ type: 'X', detail: { square: 0 } })
  trigger({ type: 'X', detail: { square: 7 } })
  trigger({ type: 'X', detail: { square: 6 } })
  trigger({ type: 'X', detail: { square: 3 } })
  //@ts-ignore: test
  expect(actual).toEqual({
    player: "X",
    win: [ 0, 3, 6 ],
  })
  expect(board).toEqual(new Set())
})
```

Here is an example of how `X` could win. Notice that the winning move is `[ 0, 3, 6 ]` not `[ 6, 7, 8 ]`. That's because of the order of the winning conditions in the `winConditions` array. The order of operations really matters in bProgram.