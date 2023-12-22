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

Let's start with a the board and we'll use an array to represent it.

```ts
const board = [
  0, 1, 2,
  3, 4, 5,
  6, 7, 8
]
```

Next up let's create an array to hold our wind conditions for our game

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

Now we will create our player's win detection threads using a function,
`playerWins`, that takes the player `X` or `O` and returns our threads by using
reduce to iterate over the `winConditions`, thus creating threads to detect when
a player has won.
