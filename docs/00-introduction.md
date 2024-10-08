# Introduction

Plaited is a web framework for rapidly designing and developing interfaces as requirements change and evolve. It's been designed for the following use cases:

  1. Developing cross-framework design systems
  2. Developing [modnet](https://rachelaliana.medium.com/past-the-internet-the-emergence-of-the-modnet-6ad49b7e2ee8) module interfaces

## Behavioral Programming

Plaited is built around [the behavioral programming algorithm](https://www.wisdom.weizmann.ac.il/~amarron/BP%20-%20CACM%20-%20Author%20version.pdf). In behavioral programming a behavioral program (`bProgram`) employs specialized programming idioms for expressing what **must**, **may**, or **must not** happen. A `bProgram` also includes a [novel method](#sync) for the collective execution of the resulting scenarios.

These specialized idioms are effectively rules for determining how we apply feedback to an object based on a triggering event initiated by the user or the system. Each `bProgram` can be broken into three parts:

1. [trigger](#trigger)(s): Send `bProgram` a `BPEvent` that initiates a run of `bProgram`
2. [threads](#threads): `RulesFunction` that apply rules based on the `SynchronizationPoint` parameters
3. [feedback](#feedback): Actions that manipulate an object based on the selected event(s)

## Trigger

Everything in Plaited is based on sending a `BPEvent` from one `bProgram` to another. Our `bProgram` agent based approach to design allows for various message passing architectural patterns. Each `BPEvent` is an object with two keys `type` and `detail`. Type is the name of the event and `detail` is optional data we pass with our event.

## Threads

The key to understanding coding in Plaited is in grasping how to work with threads.

Each thread specifies three sets of events:

**requested events**: the thread proposes that these events be considered for triggering and asks to be notified when any of the events occur.

**waited-for events**: the thread does not request these but asks to be notified when any of them are triggered.

**blocked events**: the thread currently forbids triggering any of these events

When all threads are at a synchronization point an event is chosen. That chosen event must be requested by at least one thread and may not be blocked by any other current thread. The selected event is then triggered by resuming all the threads that either requested it or are waiting for it. Each of these resumed threads then proceeds with its execution to its next synchronization point. At the next synchronization point resumed threads again present a new sets of requested, waited-for and blocked events. The other threads remain at their last synchronization points, oblivious to the triggered event, until an event is selected that they have requested or are waiting for. When all threads are again at a synchronization point, the event selection process repeats.

We build our threads by making use of three functions `sync`, `thread`, and `loop`. These functions are used to create an object of threads we pass to our `bProgram` `addThreads` method.

### Sync

As we mentioned earlier our threads continually move through synchronization points. We create these points using our `sync` function which return a `RulesFunction`. The `sync` function takes a `SynchronizationPoint` as a parameter. `SynchronizationPoint` is an object with three keys:
  
- request: A proposed `BPEvent` or a function that when invoked returns a `BPEvent` also known as a `BPEventTemplate`
- waitFor: string(s) referencing the `BPEvent` type or a callback(s) that returns a boolean. This callback receives the proposed `BPEvent` as an argument.
- block: string(s) referencing the `BPEvent` type or a callback(s) that returns boolean. This callback receives the proposed `BPEvent` as an argument.

### Thread

A single synchronization point as expressed by `sync` is often not enough to express our rules in a given thread. The function `thread` like `sync` returns a `RuleFunction`. However it is used to compose an arbitrary number of `RulesFunction` together to express more complex rules.

### Loop

Often we want to carry out a rules infinitely each time our `bProgram` is triggered, or at least while some mode or condition is still true. The `loop` function allows us to do this. Like `thread` it can be used for composition and returns a `RulesFunction`. However it's first argument can be a function that will be called at each synchronization point to see if it still returns true and thus allow our thread's synchronization points to remain in play when selecting the next `BPEvent`.

## Feedback

What about state we might ask? When we build apps using `bProgram` the state of an object is implicitly managed. Our `bProgram` orchestrates the manipulations we can apply to one or more object in a natural manner. This is possible because of the `bProgram` `feedback` method.

The `feedback` method takes an `Action` parameter which is an object of string key function pairs. Each Action function takes a detail which is provided to it by an `BPEvent` who's type is the same as the key(name) of the action function.

---

Alright that enough theory let's learn by doing. So [shall we play a game](./01-shall-play-a-game.md)
