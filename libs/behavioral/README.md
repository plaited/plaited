# @plaited/behavioral

This packages export a utility function called **bProgram** used to initiate a
behavioral programs. This package is re-exported by
[plaited](https://www.npmjs.com/package/plaited). Each isle created by plaited
instantiates it's own reactive behavioral program to enable dynamic
interactions.

## Learn about behavioral programing

- Article:[Behavioral Programming, 2012](https://m-cacm.acm.org/magazines/2012/7/151241-behavioral-programming/fulltext)
- Video:
  [Rethinking Software Systems: A friendly introduction to Behavioral Programming by Michael Bar Sinai, 2018](https://youtu.be/PW8VdWA0UcA)

## bProgram

- args:options object.
  - selection: a string `priority | randomized | chaos` defaults to priority
    selection strategy
  - dev: a callback function to consume state charts of the type
    [DevCallback](libs/behavioral/src/types.ts)
- return: object
  - addThread: a function to add behavioral threads to program
  - feedback: a function to connect action functions to behavioral program
  - trigger: a function that will cause a run and event on behavioral program
  - loop: a behavioral thread that loops infinitely or until some callback
    returns false like a mode change open -> close. This function returns a
    behavioral thread
  - thread: function that returns a behavioral threads. The function takes sync
    and other behavioral threads as it's arguments. threads as it's arguments.
  - sync: returns a synchronization set to be used by thread and loop

**Example: hot & cold water**

```ts
import { bProgram } from "@plaited/behavioral";

test("interleave", () => {
  const actual: string[] = [];
  const { addThreads, thread, sync, trigger, feedback, loop } = bProgram();
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

**Example: tic-tac-toe**

```ts
import { bProgram } from "@plaited/behavioral";

test("prevent completion of line with two Xs", () => {
  const { sync, addThreads, thread, feedback, trigger, loop } = bProgram();
  const actual: (
    | { player: "X" | "O"; square: number }
    | { player: "X" | "O"; win: number[] }
  )[] = [];
  const playerWins = (player: string) =>
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

  const prtypeCompletionOfLineWithTwoXs = winConditions.reduce(
    (acc: Record<string, RulesFunc>, win) => {
      acc[`StopXWin(${win})`] = thread(
        sync<{ square: number }>({
          waitFor: {
            cb: ({ type, detail }) =>
              type === "X" && win.includes(detail.square),
          },
        }),
        sync<{ square: number }>({
          waitFor: {
            cb: ({ type, detail }) =>
              type === "X" && win.includes(detail.square),
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
  addThreads({
    ...playerWins("O"),
    ...playerWins("X"),
    enforceTurns: loop([
      sync({ waitFor: { type: "X" }, block: { type: "O" } }),
      sync({ waitFor: { type: "O" }, block: { type: "X" } }),
    ]),
    ...squaresTaken,
    stopGame: thread(
      sync({ waitFor: [{ type: "XWin" }, { type: "OWin" }] }),
      sync({ block: [{ type: "X" }, { type: "O" }] }),
    ),
    ...prtypeCompletionOfLineWithTwoXs,
    startAtCenter: thread(
      sync({
        request: {
          type: "O",
          detail: { square: 4 },
        },
      }),
    ),
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
  //@ts-ignore: test
  expect(actual).toEqual([
    { player: "X", square: 0 },
    { player: "O", square: 4 },
    { player: "X", square: 3 },
    { player: "O", square: 6 },
  ]);
});
```
