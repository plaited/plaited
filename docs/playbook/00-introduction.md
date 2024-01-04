# Introduction

Plaited is a web framework for rapidly designing and developing interfaces as requirements change and evolve. It's been designed for the following use cases:

  1. Developing cross-framework design systems
  2. Developing [modnet web apps](https://rachelaliana.medium.com/past-the-internet-the-emergence-of-the-modnet-6ad49b7e2ee8)

## Behavioral Programming

Plaited is built around the behavioral programming algorithm. In behavioral programming a behavioral program `bProgram` employs specialized programming idioms for expressing what must, may,
or must not happen, and a novel method for the collective execution of the resulting scenarios.

These specialized idoms are effectively rules for determining how we apply feedback to an object based on a triggering event, be it user or system initiated. Each `bProgram` can be broken into three parts:

1. trigger(s): Send `bProgram` a `BPEvent` that initiates a run of `bProgram`
2. threads: `RulesFunction` that apply rules based on the `RuleSet` parameters
3. feedback: Actions that manipulate an object based on the selected event(s)

## Trigger

Everything in Plaited is based on sending a `BPEvent` from one `bProgram` to another. Our `bProgram` agent based approach to design allows for various message passing based architectural patterns. Each `BPEvent` is an object that consist of two keys `type` and `detail`. Type is the name of the event and `detail` is optional data we pass with our event.

## Threads

The key to understanding coding in Plaited is in grasping how to work with threads.

Each thread specifies three sets of events: (1) requested events: the thread proposes that these be considered for triggering, and asks to be notified when any of them occurs; (2) waited-for events: the thread does not request these, but asks to be notified when any of them is triggered; and (3) blocked events: the thread currently forbids triggering any of these events

When all threads are at a synchronization point, an event is chosen, that is requested by at least one thread and is not blocked by any thread. The selected event is then triggered by resuming all the threads that either requested it or are waiting for it. Each of these resumed threads then proceeds with its execution, all the way to its next synchronization point, where it again presents new sets of requested, waited-for and blocked events. The other threads remain at their last synchronization points, oblivious to the triggered event, until an event is selected that they have requested or are waiting for. When all threads are again at a synchronization point, the event selection process repeats.

We build our threads by making use of three functions `sync`, `thread` & `loop`. These functions are used to create an object of threads we pass to our `bProgram` `addThreads` method.

### Sync

As we mentioned earlier our threads continually move through synchronization points. We create these points using our `sync` function which return a `RulesFunction`. The `sync` function takes a `RuleSet` as a parameter. `RuleSet` is an object with three keys:
  
- waitFor: string(s) referencing the `BPEvent` type or a callback(s) that returns true. This callback receives the proposed `BPEvent` as an argument.
- block: string(s) referencing the `BPEvent` type or a callback(s) that returns true. This callback receives the proposed `BPEvent` as an argument.
- request: Proposed `BPEvent` or a function that when invoked returns a `BPEvent` also known as a `BPEventTemplate`

### Thread

A single synchronization point as expressed by `sync` is often not enough to express our rules in a given thread. The function `thread` like `sync` returns a `RuleFunction`. However it is used to compose an arbitrary number of `RulesFunction` together to express more complex rules.

### Loop

Often we want to carry out a rules infinitely each time our `bProgram` is triggered, or at least while some mode or condition is still true. The `loop` function allows us to do this. Like `thread` it can be used for composition and returns a `RulesFunction`. However it's first argument can be a synchronous function that will be called at each synchronization point to see if it still returns true and thus allow our threads synchronization points to remain in play when selecting the next `BPEvent`.

## Feedback

What about state we might ask? When we build are apps using `bProgram` the state of an object is  is implicitly managed. Our `bProgram` orchestrates the manipulations we can apply to one or more object in a natural manner. This is possible because of the `bProgram` `feedback` method.

The `feedback` method takes an `Action` parameter which is an object string key function pairs. Each Action function takes a detail which is provided to it by an `BPEvent` who's type is the same as the key(name) of the action function.

---

Alright that enough theory let's learn by doing. So [shall we play a game](./01-shall-play-a-game.md)
