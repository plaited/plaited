import { expect, test } from 'bun:test'
import { behavioral, bSync, bThread, type RulesFunction } from 'plaited.ts'

/** Represents all possible winning combinations of squares in Tic-Tac-Toe. */
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

/** An array representing all squares on the Tic-Tac-Toe board, indexed 0 through 8. */
const squares = [0, 1, 2, 3, 4, 5, 6, 7, 8]

/** Represents the current state of the Tic-Tac-Toe board, storing available squares. */
let board: Set<number>
/** Type definition for the detail payload of 'X' and 'O' events, indicating the chosen square. */
type Square = { square: number }

/**
 * Test case: Demonstrates the basic mechanism of taking a square.
 * It sets up a bProgram and uses feedback handlers (`useFeedback`) to update the board state
 * when 'X' or 'O' events are triggered. This test verifies that triggering an event
 * correctly modifies the shared `board` state via the feedback mechanism.
 */
test('taking a square', () => {
  // Create a new bProgram instance.
  const { useFeedback, trigger } = behavioral()
  // Initialize the board with all squares available for this test.
  board = new Set(squares)
  // Register feedback handlers to react to 'X' and 'O' events.
  useFeedback({
    /** Feedback handler for the 'X' event. Removes the chosen square from the board. */
    X({ square }: Square) {
      board.delete(square)
    },
    /** Feedback handler for the 'O' event. Removes the chosen square from the board. */
    O({ square }: Square) {
      board.delete(square)
    },
  })
  // X takes square 1
  trigger({ type: 'X', detail: { square: 1 } })
  // Check if square 1 is removed from the board.
  expect(board.has(1)).toBe(false)
  // O takes square 0
  trigger({ type: 'O', detail: { square: 0 } })
  // Check if square 0 is removed from the board.
  expect(board.has(0)).toBe(false)
})

/**
 * A b-thread that enforces strict turn-taking between players 'X' and 'O'.
 * It waits for 'X', then blocks 'X' while waiting for 'O', and repeats.
 * The `true` argument makes the thread loop indefinitely.
 */
const enforceTurns = bThread([bSync({ waitFor: 'X', block: 'O' }), bSync({ waitFor: 'O', block: 'X' })], true)

/**
 * Test case: Verifies the `enforceTurns` b-thread correctly manages player turns.
 * It adds the `enforceTurns` thread to the bProgram.
 * Attempts to make 'O' take two turns in a row should fail due to the blocking mechanism.
 */
test('take turns', () => {
  // Create a new bProgram instance.
  const { useFeedback, trigger, bThreads } = behavioral()
  // Initialize the board.
  board = new Set(squares)
  // Add the turn-enforcing thread.
  bThreads.set({
    enforceTurns,
  })
  // Register feedback handlers to update the board.
  useFeedback({
    X({ square }: Square) {
      board.delete(square)
    },
    O({ square }: Square) {
      board.delete(square)
    },
  })
  // X takes square 1 (valid).
  trigger({ type: 'X', detail: { square: 1 } })
  expect(board.has(1)).toBe(false)
  // O takes square 0 (valid).
  trigger({ type: 'O', detail: { square: 0 } })
  expect(board.has(0)).toBe(false)
  // O attempts to take square 2 immediately (invalid, blocked by enforceTurns).
  trigger({ type: 'O', detail: { square: 2 } })
  // Check that square 2 is still available because O's second move was blocked.
  expect(board.has(2)).toBe(true)
})

/**
 * A collection of b-threads, one for each square, to prevent taking an already occupied square.
 * Each thread waits for any player ('X' or 'O') to take its specific square,
 * then blocks any further attempts to take that same square.
 */
const squaresTaken: Record<string, RulesFunction> = {}
for (const square of squares) {
  squaresTaken[`(${square}) taken`] = bThread([
    // Wait for an event (X or O) targeting this specific square.
    bSync({ waitFor: ({ detail }) => square === detail.square }),
    // Once taken, block any future event targeting this square.
    bSync({ block: ({ detail }) => square === detail.square }),
  ])
}

/**
 * Test case: Verifies that the `squaresTaken` threads prevent players from choosing occupied squares.
 * It combines `enforceTurns` and `squaresTaken`.
 * An attempt by 'X' to take square 1 again after it's already taken should be blocked.
 * Because X's invalid move was blocked, it remains X's turn, preventing O's subsequent move.
 */
test('squares taken', () => {
  // Create a new bProgram instance.
  const { useFeedback, trigger, bThreads } = behavioral()
  // Initialize the board.
  board = new Set(squares)
  // Add threads for turn enforcement and preventing taking occupied squares.
  bThreads.set({
    enforceTurns,
    ...squaresTaken,
  })
  // Register feedback handlers.
  useFeedback({
    X({ square }: Square) {
      board.delete(square)
    },
    O({ square }: Square) {
      board.delete(square)
    },
  })
  // X takes square 1 (valid).
  trigger({ type: 'X', detail: { square: 1 } })
  expect(board.has(1)).toBe(false)
  // O takes square 0 (valid).
  trigger({ type: 'O', detail: { square: 0 } })
  expect(board.has(0)).toBe(false)
  // X attempts to take square 1 again (invalid, blocked by squaresTaken[`(1) taken`]).
  trigger({ type: 'X', detail: { square: 1 } })
  // O attempts to take square 2 (invalid, blocked by enforceTurns because X's last move was blocked).
  trigger({ type: 'O', detail: { square: 2 } })
  expect(board.has(2)).toBe(true) // Square 2 remains available.
  // X takes square 2 (valid, as the previous invalid moves were blocked).
  trigger({ type: 'X', detail: { square: 2 } })
  expect(board.has(2)).toBe(false)
})

/** Type definition for the detail payload of the 'win' event. */
type Winner = { player: 'X' | 'O'; squares: number[] }

/**
 * Generates a set of b-threads to detect winning conditions for a specific player ('X' or 'O').
 * For each winning line defined in `winConditions`, it creates a thread that:
 * 1. Waits for the player to take the first square in that line.
 * 2. Waits for the player to take the second square in that line.
 * 3. Waits for the player to take the third square in that line.
 * 4. Requests a 'win' event, declaring the player and the winning line.
 * @param player The player ('X' or 'O') for whom to detect wins.
 * @returns A record of b-threads, one for each potential winning line for the player.
 */
const detectWins = (player: 'X' | 'O') =>
  winConditions.reduce((acc: Record<string, RulesFunction>, squares) => {
    acc[`${player}Wins (${squares})`] = bThread([
      // Wait for the player to take the first square of this winning line.
      bSync({
        waitFor: ({ type, detail }) => type === player && squares.includes(detail.square),
      }),
      // Wait for the player to take the second square of this winning line.
      bSync({
        waitFor: ({ type, detail }) => type === player && squares.includes(detail.square),
      }),
      // Wait for the player to take the third square of this winning line.
      bSync({
        waitFor: ({ type, detail }) => type === player && squares.includes(detail.square),
      }),
      // Request a 'win' event if all three squares are taken by the player.
      bSync({
        request: { type: 'win', detail: { squares, player } },
      }),
    ])
    return acc
  }, {})

/**
 * Test case: Verifies that the `detectWins` threads correctly identify a winning condition.
 * It includes threads for turn enforcement, square occupation, and win detection for both players.
 * A sequence of moves leading to X winning along the top row [0, 1, 2] is simulated.
 */
test('detect winner', () => {
  // Create a new bProgram instance.
  const { useFeedback, trigger, bThreads } = behavioral()
  // Initialize the board.
  board = new Set(squares)
  // Add threads for game rules and win detection.
  bThreads.set({
    enforceTurns,
    ...squaresTaken,
    ...detectWins('X'),
    ...detectWins('O'),
  })
  /** Stores the winner information when a 'win' event occurs. */
  const winner: Winner | Record<string, unknown> = {}
  // Register feedback handlers, including one for the 'win' event.
  useFeedback({
    X({ square }: { square: number }) {
      board.delete(square)
    },
    O({ square }: { square: number }) {
      board.delete(square)
    },
    /** Feedback handler for the 'win' event. Records the winner details. */
    win(detail: Winner) {
      Object.assign(winner, detail) // Assign the winner details to the winner variable.
    },
  })
  // Simulate moves leading to X winning.
  trigger({ type: 'X', detail: { square: 0 } })
  trigger({ type: 'O', detail: { square: 3 } })
  trigger({ type: 'X', detail: { square: 1 } })
  trigger({ type: 'O', detail: { square: 4 } })
  trigger({ type: 'X', detail: { square: 2 } }) // X completes the [0, 1, 2] line.
  // Verify that the 'win' event was triggered with the correct details.
  expect(winner).toEqual({ player: 'X', squares: [0, 1, 2] })
})

/**
 * A b-thread that stops the game once a 'win' event occurs.
 * It waits for the 'win' event and then blocks any further 'X' or 'O' moves indefinitely.
 */
const stopGame = bThread([bSync({ waitFor: 'win' }), bSync({ block: ['X', 'O'] })], true)

/**
 * Test case: Verifies that the `stopGame` thread prevents further moves after a win.
 * It includes all previous rule threads plus `stopGame`.
 * After X wins, an attempt by O to make another move should be blocked.
 */
test('stop game', () => {
  // Create a new bProgram instance.
  const { useFeedback, trigger, bThreads } = behavioral()
  // Initialize the board.
  board = new Set(squares)
  // Add all game rule threads, including the one to stop the game on win.
  bThreads.set({
    enforceTurns,
    ...squaresTaken,
    ...detectWins('X'),
    ...detectWins('O'),
    stopGame,
  })
  const winner: Winner | Record<string, unknown> = {}
  // Register feedback handlers.
  useFeedback({
    X({ square }: { square: number }) {
      board.delete(square)
    },
    O({ square }: { square: number }) {
      board.delete(square)
    },
    win(detail: Winner) {
      Object.assign(winner, detail)
    },
  })
  // Simulate moves leading to X winning.
  trigger({ type: 'X', detail: { square: 0 } })
  trigger({ type: 'O', detail: { square: 3 } })
  trigger({ type: 'X', detail: { square: 1 } })
  trigger({ type: 'O', detail: { square: 4 } })
  trigger({ type: 'X', detail: { square: 2 } }) // X wins.
  expect(winner).toEqual({ player: 'X', squares: [0, 1, 2] })
  // O attempts to take square 5 after the game has ended (invalid, blocked by stopGame).
  trigger({ type: 'O', detail: { square: 5 } })
  // Verify square 5 is still available because O's move was blocked.
  expect(board.has(5)).toBe(true)
})

/**
 * A collection of b-threads representing default moves for player 'O'.
 * Each thread requests to take a specific square ('O' move) and repeats indefinitely.
 * These act as low-priority suggestions for O's moves.
 */
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

/**
 * Test case: Demonstrates the use of default moves for player 'O'.
 * When it's O's turn, and no higher-priority strategy dictates a move,
 * one of the `defaultMoves` threads will have its request selected.
 * The specific square chosen depends on internal priority and blocking.
 */
test('defaultMoves', () => {
  // Create a new bProgram instance.
  const { useFeedback, trigger, bThreads } = behavioral()
  // Initialize the board.
  board = new Set(squares)
  // Add game rules and default moves for O.
  bThreads.set({
    enforceTurns,
    ...squaresTaken,
    ...detectWins('X'),
    ...detectWins('O'),
    stopGame,
    ...defaultMoves, // Add the default move threads.
  })

  // Register feedback handlers.
  useFeedback({
    X({ square }: { square: number }) {
      board.delete(square)
    },
    O({ square }: { square: number }) {
      board.delete(square)
    },
  })
  // X takes square 0.
  trigger({ type: 'X', detail: { square: 0 } })
  // Now it's O's turn. Since no specific strategy applies yet, a default move is made.
  // The exact square taken by O (e.g., 1) depends on the implicit priority of the default move threads.
  expect(board.has(1)).toBe(false) // Assuming default move for square 1 gets selected first.
})

/**
 * A b-sync definition representing a strategy for player 'O' to start by taking the center square (4).
 * This is a single, high-priority request.
 */
const startAtCenter = bSync({
  request: {
    type: 'O',
    detail: { square: 4 },
  },
})

/**
 * Test case: Demonstrates overriding default moves with a specific strategy.
 * The `startAtCenter` strategy is added with higher priority (implicitly, by being added later or explicitly)
 * than the `defaultMoves`. When it's O's first turn, `startAtCenter` should be selected over any default move.
 */
test('start at center', () => {
  // Create a new bProgram instance.
  const { useFeedback, trigger, bThreads } = behavioral()
  // Initialize the board.
  board = new Set(squares)
  // Add game rules, the center strategy, and default moves.
  // `startAtCenter` likely has higher priority due to registration order or could be set explicitly.
  bThreads.set({
    enforceTurns,
    ...squaresTaken,
    ...detectWins('X'),
    ...detectWins('O'),
    stopGame,
    startAtCenter, // Add the specific strategy.
    ...defaultMoves, // Default moves have lower priority.
  })

  // Register feedback handlers.
  useFeedback({
    X({ square }: { square: number }) {
      board.delete(square)
    },
    O({ square }: { square: number }) {
      board.delete(square)
    },
  })
  // X takes square 0.
  trigger({ type: 'X', detail: { square: 0 } })
  // Now it's O's turn. The `startAtCenter` strategy should be selected.
  expect(board.has(4)).toBe(false) // Verify O took the center square.
})

/**
 * Generates b-threads for player 'O' to block player 'X' from winning.
 * For each potential winning line:
 * 1. Waits for 'X' to take two squares in that line.
 * 2. Requests an 'O' move to take the remaining empty square in that line, thus blocking 'X'.
 * @param board The current board state (Set of available squares) used to find the blocking square.
 * @returns A record of b-threads, one for each potential winning line, designed to block X.
 */
const preventCompletionOfLineWithTwoXs = (board: Set<number>) => {
  const bThreads: Record<string, RulesFunction> = {}
  for (const win of winConditions) {
    bThreads[`StopXWin(${win})`] = bThread([
      // Wait for X to take the first square in this line.
      bSync({
        waitFor: ({ type, detail }) => type === 'X' && win.includes(detail.square),
      }),
      // Wait for X to take the second square in this line.
      bSync({
        waitFor: ({ type, detail }) => type === 'X' && win.includes(detail.square),
      }),
      // Request an 'O' move to take the remaining square in this line.
      bSync({
        // Dynamically determine the square to request based on the current board state.
        request: () => ({ type: 'O', detail: { square: win.find((num) => board.has(num)) as number } }),
      }),
    ])
  }
  return bThreads
}

/**
 * Test case: Verifies the 'preventCompletionOfLineWithTwoXs' strategy.
 * This test sets up a scenario where 'X' is about to win on line [6, 7, 8].
 * The blocking strategy for 'O' should detect this and request 'O' take square 7.
 * It combines all previous rules with this blocking strategy.
 */
test('prevent completion of line with two Xs', () => {
  // Create a new bProgram instance.
  const { useFeedback, trigger, bThreads } = behavioral()
  // Initialize the board.
  board = new Set(squares)
  // Add all game rules, including the blocking strategy for O.
  bThreads.set({
    enforceTurns,
    ...squaresTaken,
    ...detectWins('X'),
    ...detectWins('O'),
    stopGame,
    ...preventCompletionOfLineWithTwoXs(board), // Add the blocking strategy.
    startAtCenter, // O prefers center if no block is needed.
    ...defaultMoves, // Lowest priority moves.
  })
  const winner: Winner | Record<string, unknown> = {}
  // Register feedback handlers with specific types for clarity.
  useFeedback({
    X({ square }: Square) {
      board.delete(square)
    },
    O({ square }: Square) {
      board.delete(square)
    },
    win(detail: Winner) {
      Object.assign(winner, detail) // Assign the winner details to the winner variable.
    },
  })
  // Simulate moves:
  trigger({ type: 'X', detail: { square: 2 } }) // O takes 4 (center)
  trigger({ type: 'X', detail: { square: 6 } }) // O takes 0 (default/block?)
  trigger({ type: 'X', detail: { square: 8 } }) // X has 6 and 8. O MUST block at 7.
  // Verify O blocked X by taking square 7.
  expect(board.has(7)).toBe(false)
  // X takes 5, completing the line [2, 5, 8] and winning.
  trigger({ type: 'X', detail: { square: 5 } })
  // Verify X won with the expected line.
  expect(winner).toEqual({ player: 'X', squares: [2, 5, 8] })
})
