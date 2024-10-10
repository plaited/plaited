# Shall we play a game?

The game is tic-tac-toe. While it may seem counter intuitive for a UI library we won't be starting with the UI. In fact we should leave the [UI as an afterthought](https://michel.codes/blogs/ui-as-an-afterthought) for the time being.

## Setup

We start by importing a new `bProgram` to orchestrate our game.

```ts
import { bProgram, loop, RulesFunc, sync, thread } from 'plaited'
```

Here we've brought in `bProgram`, the threads functions `loop`, `sync`, and `thread` and a typescript definition for our `RulesFunc`.

Next, we'll create some data structures.

First we'll need a object to represent the game. We'll call this `squares`.

```ts
const squares = [
  0, 1, 2,
  3, 4, 5,
  6, 7, 8
]
```

Then we then want to define our winning conditions for players.

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

Finally we want to create a few variable that represents our board and a type representing our square to be used by our `SynchronizationPoint` and `trigger`.

```ts
let board: Set<number>
type Square = { square: number }
```

## Requirements

From here we'll use test driven development (TDD) to validate our program as we iteratively add requirements

### Taking a square

We assign the `board` by initiating a new Set using the squares array. Then we call the `bProgram` to initiate a new behavioral program and destructure our `feedback` and `trigger` methods. We pass our `feedback` an actions object that consist of two actions `X` and `O` which when either are called, will delete the corresponding square from the board.

To test that this works we call trigger with the `BPEvent` `{ type: 'X', detail: { square: 1 } }` and assert that the `board` no longer has `1` in it. We do the same for an `O`.

```ts
test('taking a square', () => {
  // We create a new bProgram
  const { feedback, trigger } = bProgram()
  // We create a new board for the game
  board = new Set(squares)
  feedback({
    // When BPEvent X happens delete the square provided in the event's detail
    X({ square }: Square) {
      board.delete(square)
    },
    // When BPEvent O happens delete the square provided in the event's detail
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
```

In the current scenario. This works but there is nothing stopping `X` or `O` from going twice in a row.

### Enforcing turns

We'll add a new thread, `enforceTurns`, which loops between two sync statements `onlyXCanGo` and `onlyOCanGo`. Only one of these statements can be enforced at any one time. This enforces the rule of the game that they take turns until someone wins.

```ts
// sync threads to wait for each player and block the other.
const onlyXCanGo = sync<Square>({ waitFor: 'X', block: 'O' })
const onlyOCanGo = sync<Square>({ waitFor: 'O', block: 'X' })

// A loop thread iterates between sync threads after each is requested.
const enforceTurns = loop(onlyXCanGo, onlyOCanGo)

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
  trigger({ type: 'O', detail: { square: 2} })
  // We check to make sure 2 is still in the board
  expect(board.has(2)).toBe(true)
})
```

In the test above `X` takes it's first turn but after playing square `1` it can't make any more moves until `O` takes a turn. `O` takes it's turn by playing square `0` but then attempts to take an extra turn however, no matter how many times `O` triggers another move the game will only recognize it's move as the last approved request, which is square `0`.

But right now there is nothing stopping `X` from also playing a move on `0` in the next round. Let's add new threads preventing players from making moves on squares that are already taken.

### Squares taken

Our games logic dictates that each square may only be taken by players once. After that, all other moves on that square are blocked. Here we loop over our squares an create a thread for each square with two synchronization points `waitFor` and `block`. Because they are `sync` functions the `block` thread will only be reached after the square has been requested by `X` or `O`.

```ts
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
    // When BPEvent O happens we delete the square provided in the event's detail
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
  // O can't take it's turn because the program is still waiting for X to take a valid turn.
  expect(board.has(2)).toBe(true)
  // X takes square 2
  trigger({ type: 'X', detail: { square: 2 } })
  expect(board.has(2)).toBe(false)
})
```

`X` and `O` will now take turns and no more than one player will be able to make a move on any one square. But how do we detect when a player wins?

### Detect winner

The function `detectWins` takes the player `X` or `O` and returns the respective threads by using reduce to iterate over the `winConditions`, thus allowing our `bProgram` to detect when a player has won.

```ts
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
  expect(winner).toEqual({ player: 'X', squares: [0, 1, 2] })
})
```

We've used our `detectWins` function to generate an object of win detection threads for each player. We then pass those to our `addThreads` method as a spread. Enabling us to satisfy this new requirement. Now that we can detect when a player has won a game we need our program to stop after a winner has been detected.

### Stop game

We want to stop the game when it has been won. We create a new `thread` for this requirement that contains two synchronization points. The first waits for the `win` `BPEvent`. The second then blocks further `X` or `O` events. Because the second synchronization point does not contain a `waitFor` or `request` parameter this `thread` remains at this last synchronization point blocking all future attempts at taking another square.

```ts
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
  expect(winner).toEqual({ player: 'X', squares: [0, 1, 2] })
  // O tries to take square 5 after a winner has been declared
  trigger({ type: 'O', detail: { square: 5 } })
  expect(board.has(5)).toBe(true)
})
```

Unfortunately we don't have anyone to play with so we need our game to provide us with a second player. It's time to teach our program how to make some moves.

### Default Moves

For every square we want to create a thread for our `bProgram` to be able to request an `O` `BPEvent`, thus enabling our app to take on the role of `O`. This will be our first time using the `request` parameter in a `SynchronizationPoint`.

With that in mind there are a couple of things to note. The **order** in which we add our threads matters. Thread prioritization follows a first in - first out pattern with the higher thread having the greater prioritization. This means that if two threads request a `BPEvent` at the same synchronization point then the one with the higher priority will be selected.

```ts
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
```

Notice that the first square will have a greater priority than the last square based on the order they appear in the squares array we are looping over to create our `defaultMoves` threads. The only exception being if that square has already been taken by a player and future moves blocked by our `squaresTaken` threads. Our test verifies our selected default move for `O` took `square` 1.

But a computer player that always plays from `0` to `8` is boring. How about we add some smarts?

### Start at center

Let's make it more strategic in it's play. We create a `startAtCenter` thread and add to addThreads method before `defaultMoves`. This will give `startAtCenter` a higher priority when an event is requested.

```ts
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
```

We make a basic move taking the top left corner. Then our program takes the center `square` 4. If the app was really a good player, it would also try to stop it's opponent from winning.

### Prevent completion of line with two Xs

We need to prevent the completion of a line of three squares. Thus we create a function called `preventXFromCompletingALine` that returns the threads necessary to do so. Our app will now try to prevent the completion of a line with two squares already taken. We pass in this spread of threads before before `startAtCenter` so our app will always check if `X` has already taken two squares in a line before making a move.

```ts
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
        request: () => ({ type: 'O', detail: { square: win.find((num) => board.has(num)) } }),
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
  expect(winner).toEqual({ player: 'X', squares: [2, 5, 8] })
})
```

So now we have working implementation of the logic for our tic-tac-toe app. Even though our program blocked `X` from winning with **[6, 7, 8]**. We are still able to win by taking 5! That's because of the order of the winning conditions in the `winConditions` array. The order of operations really matters in bProgram when creating threads.

---

Now maybe we really should start thinking about our [user interface](./02-user-interface.md) and the new requirements that result from?
