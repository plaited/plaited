# @plaited/behavioral

This package exports **bProgram** a utility used for creating behavioral
programs in JavaScript.

## Requirements

### JavaScript runtime options

1. [Node](https://nodejs.org/en) >= v18
2. [Bun](https://bun.sh/) >= 0.5.9
3. Any modern evergreen browser

## Installing

`npm install --save @plaited/behavioral`

`import { bProgram } from 'https://esm.sh/@plaited/behavioral@3.0.1'`

- Example usage:
  - [Water flow control](#scenario-water-flow-control)
  - [tic-tac-toe](#scenario-tic-tac-toe)
- Types of note:
  - [Event detail](#event-detail)
  - [Request event and trigger argument](#request-event-and-trigger-argument)
  - [WaitFor and block events](#waitfor-and-block-events)
  - [Sync argument](#sync-argument)

## What is behavioral programming?

> Behavioral Programming, or bProgram for short, is based on scenarios.
> Behavioral programs are composed of threads of behavior. These threads run in
> parallel to coordinate a sequence of events via a synchronized protocol.
> During a bProgram's execution, when a thread wants to synchronize with its
> peers, it submits a statement to the central event arbiter using the sync
> statement. This statement is returned when we invoke a bProgram. A **sync**
> statement declares which events the **thread** requests, which events it waits
> for (but does not request), and which events it would like to block (that is,
> prevent from being selected). Request, block and waitFor events can be
> described by passing a RuleSet object to the sync statement as parameter.

```ts
export type RuleSet<
  T extends (Detail) = (Detail), = {
  waitFor?: ParameterIdiom< | ParameterIdiom<[];
  request?: RequestIdiom< | RequestIdiom<[];
  block?: ParameterIdiom< | ParameterIdiom<[];
};
```

> After calling sync, the thread is blocked, waiting for the rest of the threads
> to synchronize as well. When all threads have submitted their statements, the
> arbiter selects an event that was requested but not blocked. It then wakes up
> the threads that requested or waited for that event. The rest of the threads
> remain blocked, until an event they requested or waited for is selected.

> Behavioral Programming was introduced by Harel, Marron and Weiss in 2012 in a
> [paper](assets/behavioral-programming.pdf) published at the Communications of
> the ACM.

[What is Behavioral Programming?](https://bpjs.readthedocs.io/en/latest/BPjsTutorial/index.html)

To learn more:

1. Watch:
   [Rethinking Software Systems: A friendly introduction to Behavioral Programming by Michael Bar Sinai, 2018](https://youtu.be/PW8VdWA0UcA)
2. Read:
   [Learn about behavioral programming](https://github.com/plaited/plaited/tree/main/playbook/coding/learn-about-behavioral-programming.md)

## Example Usage

In each of the scenarios below we'll demonstrated using bProgram using our
tests. Think of them as guided TDD!.

### Scenario: water flow control

We want to create an app that controls hot and cold water taps, whose output
flows are mixed.

### 1. Lets make our app add hot water 3 times:

```ts
import { expect, test } from "bun:test";
import { bProgram, DevCallback } from "@plaited/behavioral";

test("Add hot water 3 times", () => {
  const actual: string[] = [];
  const {
    /** adds behavioral threads to behavioral program  **/
    addThreads,
    /**
     * creates a behavioral thread from synchronization sets and/or other  behavioral threads
     */
    thread,
    /**
     * At synchronization points, each behavioral thread
     * specifies three sets of events:
     * 1. requested events: the thread proposes that these be
     * considered for triggering
     * 2. waitFor events: the thread asks to be notified when
     * any of them is triggered
     * 3. blocked events: the threads currently forbids
     * triggering any of these events
     */
    sync,
    /** trigger the run of the behavioral program by requesting
     * the event passed as an argument
     */
    trigger,
    /** connect an action callback to the behavioral program that is
     * called when request event type of the same name as our
     * callback is selected by our behavioral program's
     * central event arbiter
     */
    feedback,
  } = bProgram();
  addThreads({
    addHot: thread(
      sync({ request: { type: "hot" } }),
      sync({ request: { type: "hot" } }),
      sync({ request: { type: "hot" } }),
    ),
  });
  feedback({
    hot() {
      actual.push("hot");
    },
  });
  trigger({ type: "start" });
  expect(actual).toEqual(["hot", "hot", "hot"]);
});
```

Alright that looks good!

**Note** : On `trigger({ type: "start" });` the type value in our event could be
any string really to trigger a run on our program but it's probably best that
it's not `trigger({ type: "hot" })` or `trigger({ type: "cold" })` as those are
events we're requesting in our synchronization points. If we used either we'd be
prematurely triggering the **action** callbacks we passed to our **feedback**
function.

### 2. Now let's also add cold water 3 times:

```ts
test("Add hot/cold water 3 times", () => {
  const actual: string[] = [];
  const { addThreads, thread, sync, trigger, feedback } = bProgram();
  addThreads({
    addHot: thread(
      sync({ request: { type: "hot" } }),
      sync({ request: { type: "hot" } }),
      sync({ request: { type: "hot" } }),
    ),
    addCold: thread(
      sync({ request: { type: "cold" } }),
      sync({ request: { type: "cold" } }),
      sync({ request: { type: "cold" } }),
    ),
  });
  feedback({
    hot() {
      actual.push("hot");
    },
    cold() {
      actual.push("cold");
    },
  });
  trigger({ type: "start" });
  expect(actual).toEqual([
    "hot",
    "hot",
    "hot",
    "cold",
    "cold",
    "cold",
  ]);
});
```

Hmmm... it's not mixing the two.We gotta fix that

#### 3. Let's mix the the flow of hot and cold water

We want to interleave the **hot** and **cold** request events. We'll use `loop`
to do so by looping back and forth between blocking one event while we wait for
the other event at each synchronization step of our bProgram run.

```ts
test("interleave", () => {
  const actual: string[] = [];
  const {
    addThreads,
    thread,
    sync,
    trigger,
    feedback,
    /**
     * A behavioral thread that loops infinitely or until some callback returns false.This function returns a threads
     */
    loop,
  } = bProgram();
  addThreads({
    addHot: thread(
      sync({ request: { type: "hot" } }),
      sync({ request: { type: "hot" } }),
      sync({ request: { type: "hot" } }),
    ),
    addCold: thread(
      sync({ request: { type: "cold" } }),
      sync({ request: { type: "cold" } }),
      sync({ request: { type: "cold" } }),
    ),
    mixHotCold: loop([
      sync({
        waitFor: { type: "hot" },
        block: { type: "cold" },
      }),
      sync({
        waitFor: { type: "cold" },
        block: { type: "hot" },
      }),
    ]),
  });
  feedback({
    hot() {
      actual.push("hot");
    },
    cold() {
      actual.push("cold");
    },
  });
  trigger({ type: "start" });
  expect(actual).toEqual([
    "hot",
    "cold",
    "hot",
    "cold",
    "hot",
    "cold",
  ]);
});
```

**Note** how we use the loop function above. We'll be using loop a lot in our
reactive user interfaces, more often than thread actually. For example consider
when a autocomplete shifts from open to close. Controlling the visual feedback
of this transition along with whether to block events that occur in the open vs
closed mode will leverage a callback passed to loop as the function's second
argument. That callback would return `true` or `false` based on an `open` value
we would store and update on our component.

### Scenario: tic-tac-toe

Now how about something more challenging let's make a tic-tac-toe app in 8
easy(_ish_) steps.

#### 1. Let's setup our bProgram

We need to do a little setup to iteratively develop our app in a TDD like
manner. First we'll import our testing utils. Then we'll import `bProgram`,
`loop`, `thread`, and `sync` form `@plaited/behavioral`.

```ts
import { expect, test } from "bun:test";
import { bProgram, loop, RulesFunc, sync, thread } from "@plaited/behavioral";

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
];

const squares = [0, 1, 2, 3, 4, 5, 6, 7, 8];
```

#### 2. Let's write some code that allows our bProgram to detect wins

Now we will create our player's win detection threads using a function,
`playerWins`, that takes the player `X` or `O` and returns our threads by using
reduce to iterate over the `winConditions`, thus creating threads to detect when
a player has won.

```ts
const playerWins = (player: "X" | "O") =>
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
      }),
    );
    return acc;
  }, {});

test("detect wins", () => {
  const { addThreads, feedback, trigger } = bProgram();
  const actual: number[] = [];
  addThreads({
    ...playerWins("X"),
  });
  feedback({
    XWin(deatil: { win: [number, number, number] }) {
      Object.assign(actual, deatil.win);
    },
  });
  trigger({ type: "X", detail: { square: 1 } });
  trigger({ type: "X", detail: { square: 4 } });
  trigger({ type: "X", detail: { square: 7 } });
  expect(actual).toEqual([1, 4, 7]);
});
```

It works and we're off to a good start!

#### 3. Let's write some code to enforce turn taking

We'll next create a new thread, `enforceTurns`, that uses our loop function to
interleave moves.

```ts
const enforceTurns = loop([
  sync({ waitFor: { type: "X" }, block: { type: "O" } }),
  sync({ waitFor: { type: "O" }, block: { type: "X" } }),
]);

test("enforceTurns", () => {
  const { addThreads, feedback, trigger } = bProgram();
  let actual: {
    player: "X" | "O";
    square: number;
  };
  addThreads({
    ...playerWins("O"),
    ...playerWins("X"),
    enforceTurns,
  });

  feedback({
    X({ square }: { square: number }) {
      actual = {
        player: "X",
        square,
      };
    },
    O({ square }: { square: number }) {
      actual = {
        player: "X",
        square,
      };
    },
  });
  trigger({ type: "X", detail: { square: 1 } });
  trigger({ type: "X", detail: { square: 4 } });
  trigger({ type: "X", detail: { square: 7 } });
  expect(actual).toEqual({ player: "X", square: 1 });
});
```

Alright!!! Alright!!!

#### 4. Let's write some code to remove a square on the board from play

Using the same reduce approach we took with the `playerWins` function we iterate
over the squares to create our `squaresTaken` threads.

```ts
const squaresTaken = squares.reduce(
  (acc: Record<string, RulesFunc>, square) => {
    acc[`(${square}) taken`] = thread(
      sync<{ square: number }>({
        waitFor: { cb: ({ detail }) => square === detail.square },
      }),
      sync<{ square: number }>({
        block: { cb: ({ detail }) => square === detail.square },
      }),
    );
    return acc;
  },
  {},
);
test("squaresTaken", () => {
  const { addThreads, feedback, trigger } = bProgram();
  const actual: {
    player: "X" | "O";
    square: number;
  }[] = [];

  addThreads({
    ...playerWins("O"),
    ...playerWins("X"),
    enforceTurns: loop([
      sync({ waitFor: { type: "X" }, block: { type: "O" } }),
      sync({ waitFor: { type: "O" }, block: { type: "X" } }),
    ]),
    ...squaresTaken,
  });
  feedback({
    O({ square }: { square: number }) {
      actual.push({
        player: "O",
        square,
      });
    },
  });
  trigger({ type: "X", detail: { square: 0 } });
  trigger({ type: "O", detail: { square: 0 } }); // Here O try's to take an already used square
  trigger({ type: "X", detail: { square: 4 } });
  trigger({ type: "O", detail: { square: 2 } });
  trigger({ type: "X", detail: { square: 8 } });
  expect(actual).toEqual([{ player: "O", square: 2 }]);
});
```

#### 5. Let's write some code to stop the game when a player wins

We'll create a simple thread that will wait for one the win events, `XWin` |
`OWin` and then block a future move by the next player up.

```ts
const stopGame = thread(
  sync({ waitFor: [{ type: "XWin" }, { type: "OWin" }] }),
  sync({ block: [{ type: "X" }, { type: "O" }] }),
);

test("stopGame", () => {
  const { addThreads, feedback, trigger } = bProgram();
  const actual: (
    | { player: "X" | "O"; square: number }
    | { player: "X" | "O"; win: number[] }
  )[] = [];

  addThreads({
    ...playerWins("O"),
    ...playerWins("X"),
    enforceTurns,
    ...squaresTaken,
    stopGame,
  });
  feedback({
    X({ square }: { square: number }) {
      actual.push({
        player: "X",
        square,
      });
    },
    O({ square }: { square: number }) {
      actual.push({
        player: "O",
        square,
      });
    },
    XWin({ win }: { win: [number, number, number] }) {
      actual.push({
        player: "X",
        win,
      });
    },
    OWin({ win }: { win: [number, number, number] }) {
      actual.push({
        player: "O",
        win,
      });
    },
  });
  trigger({ type: "X", detail: { square: 0 } });
  trigger({ type: "O", detail: { square: 1 } });
  trigger({ type: "X", detail: { square: 4 } });
  trigger({ type: "O", detail: { square: 2 } });
  trigger({ type: "X", detail: { square: 8 } });
  trigger({ type: "O", detail: { square: 7 } });
  expect(actual).toEqual([
    { player: "X", square: 0 },
    { player: "O", square: 1 },
    { player: "X", square: 4 },
    { player: "O", square: 2 },
    { player: "X", square: 8 },
    { player: "X", win: [0, 4, 8] },
  ]);
});
```

Easy!!!

#### 6. Let's give O some default moves

We've decided this is going be a one player game and the app will take the role
of player `O`. We need to give `O` some default actions to take. So we'll use
the array method Map to iterate over the squares to create a list of events to
request.

**Note** that the first square will have greater priority than the last square
unless that square has already been taken and the move blocked by our
`squaresTaken` threads.

```ts
const defaultMoves = loop([
  sync({
    request: squares.map((square) => ({
      type: "O",
      detail: { square },
    })),
  }),
]);

test("defaultMoves", () => {
  const { addThreads, feedback, trigger } = bProgram();
  const actual: (
    | { player: "X" | "O"; square: number }
    | { player: "X" | "O"; win: number[] }
  )[] = [];

  addThreads({
    ...playerWins("O"),
    ...playerWins("X"),
    enforceTurns,
    ...squaresTaken,
    stopGame,
    defaultMoves,
  });
  feedback({
    X({ square }: { square: number }) {
      actual.push({
        player: "X",
        square,
      });
    },
    O({ square }: { square: number }) {
      actual.push({
        player: "O",
        square,
      });
    },
    XWin({ win }: { win: [number, number, number] }) {
      actual.push({
        player: "X",
        win,
      });
    },
    OWin({ win }: { win: [number, number, number] }) {
      actual.push({
        player: "O",
        win,
      });
    },
  });
  trigger({ type: "X", detail: { square: 0 } });
  trigger({ type: "X", detail: { square: 4 } });
  trigger({ type: "X", detail: { square: 8 } });
  expect(actual).toEqual([
    { player: "X", square: 0 },
    { player: "O", square: 1 },
    { player: "X", square: 4 },
    { player: "O", square: 2 },
    { player: "X", square: 8 },
    { player: "X", win: [0, 4, 8] },
  ]);
});
```

Nice!!!

#### 7. Let's have O start at the center if it's open

We want our program to be a little more strategic in it's play. So we'll add
`startAtCenter` thread above our `defaultMoves`. This will give the
`startAtCenter` thread higher priority when the central arbiter of our bProgram
selects a requested event.

```ts
const startAtCenter = thread(
  sync({
    request: {
      type: "O",
      detail: { square: 4 },
    },
  }),
);

test("startAtCenter", () => {
  const { addThreads, feedback, trigger } = bProgram();
  const actual: (
    | { player: "X" | "O"; square: number }
    | { player: "X" | "O"; win: number[] }
  )[] = [];

  addThreads({
    ...playerWins("O"),
    ...playerWins("X"),
    enforceTurns,
    ...squaresTaken,
    stopGame,
    startAtCenter,
    defaultMoves,
  });
  feedback({
    X({ square }: { square: number }) {
      actual.push({
        player: "X",
        square,
      });
    },
    O({ square }: { square: number }) {
      actual.push({
        player: "O",
        square,
      });
    },
    XWin({ win }: { win: [number, number, number] }) {
      actual.push({
        player: "X",
        win,
      });
    },
    OWin({ win }: { win: [number, number, number] }) {
      actual.push({
        player: "O",
        win,
      });
    },
  });
  trigger({ type: "X", detail: { square: 0 } });
  trigger({ type: "X", detail: { square: 4 } });
  trigger({ type: "X", detail: { square: 8 } });
  expect(actual).toEqual([
    { player: "X", square: 0 },
    { player: "O", square: 4 },
    { player: "X", square: 8 },
    { player: "O", square: 1 },
  ]);
});
```

#### 8. Let's add our last requirement for our bProgram

We're going too up the app smarts one more time. We want `O` to try and prevent
the completion of a line with two squares taken by `X`. So we'll add our
`preventCompletionOfLineWithTwoXs` threads before our `startAtCenter` thread
thus giving these threads an even greater priority when the central arbiter of
our bProgram selects a requested event.

```ts
const preventCompletionOfLineWithTwoXs = winConditions.reduce(
  (acc: Record<string, RulesFunc>, win) => {
    acc[`StopXWin(${win})`] = thread(
      sync<{ square: number }>({
        waitFor: {
          cb: ({ type, detail }) => type === "X" && win.includes(detail.square),
        },
      }),
      sync<{ square: number }>({
        waitFor: {
          cb: ({ type, detail }) => type === "X" && win.includes(detail.square),
        },
      }),
      sync<{ square: number }>({
        request: win.map((square) => ({ type: "O", detail: { square } })),
      }),
    );
    return acc;
  },
  {},
);

test("prevent completion of line with two Xs", () => {
  const { addThreads, feedback, trigger } = bProgram();
  const actual: (
    | { player: "X" | "O"; square: number }
    | { player: "X" | "O"; win: number[] }
  )[] = [];

  addThreads({
    ...playerWins("O"),
    ...playerWins("X"),
    enforceTurns,
    ...squaresTaken,
    stopGame,
    ...preventCompletionOfLineWithTwoXs,
    startAtCenter,
    defaultMoves: loop([
      sync({
        request: squares.map((square) => ({
          type: "O",
          detail: { square },
        })),
      }),
    ]),
  });
  feedback({
    X({ square }: { square: number }) {
      actual.push({
        player: "X",
        square,
      });
    },
    O({ square }: { square: number }) {
      actual.push({
        player: "O",
        square,
      });
    },
    XWin({ win }: { win: [number, number, number] }) {
      actual.push({
        player: "X",
        win,
      });
    },
    OWin({ win }: { win: [number, number, number] }) {
      actual.push({
        player: "O",
        win,
      });
    },
  });
  trigger({ type: "X", detail: { square: 0 } });
  trigger({ type: "X", detail: { square: 3 } });
  expect(actual).toEqual([
    { player: "X", square: 0 },
    { player: "O", square: 4 },
    { player: "X", square: 3 },
    { player: "O", square: 6 },
  ]);
});
```

There we have it, a working implementation of the logic for a tic-tac-toe app.
Maybe we should create a user interface next???

## Types of note

### Event Detail

Our request events can optionally contain a detail. This detail object is data
passed along when the request event is selected. It is also used by our central
arbiter when evaluating waitFor and request event callbacks `cb`. This allows
waitFor and block to respectively notify their thread about an event that
concerns it or allow their thread to block an event.

```ts
export type Detail = unknown | (() => unknown) | Event;
```

### Request event and trigger argument

This is type of the object used by the **sync** function as value to be passed
to the **request** key and the argument for our **trigger** function.

```ts
export type RequestIdiom<
  T extends (Detail) = (Detail),
> = {
  type: string;
  detail?: T;
};
```

### WaitFor and block events

This is type of object used by the **sync** function as the value to be passed
to the **waitFor** and **block** keys

```ts
export type ParameterIdiom<
  T extends (Detail) = (Detail),
> = {
  type: string;
  cb?: Callback<T>;
} | {
  type?: string;
  cb: Callback<T>;
};
```

### Sync argument

When creating a sync statement using our sync function we pass it an object of
the following type.

```ts
export type RuleSet<
  T extends (Detail) = (Detail),
> = {
  waitFor?: ParameterIdiom<T> | ParameterIdiom<T>[];
  request?: RequestIdiom<T> | RequestIdiom<T>[];
  block?: ParameterIdiom<T> | ParameterIdiom<T>[];
};
```
