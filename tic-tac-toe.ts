/* eslint-disable no-console */
import {
  Track,
  baseDynamics,
  loop,
  strand,
  waitFor,
  request,
  block,
  randomizedStrategy,
  RulesFunc,
} from './src/index'

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
const squaresTaken = squares.reduce((acc: Record<string, RulesFunc>, square) => {
  acc[`(${square}) taken`] = strand(
    waitFor({callback: ({payload}) => square === payload}),
    block({callback: ({payload}) => square === payload}),
  )

  return acc
}, {})

const playerWins = (player: string) =>
  winConditions.reduce((acc: Record<string, RulesFunc>, win) => {
    acc[`${player}Wins (${win})`] = strand(
      waitFor({
        callback: ({eventName, payload}) =>
          eventName === player && win.includes(payload),
      }),
      waitFor({
        callback: ({eventName, payload}) =>
          eventName === player && win.includes(payload),
      }),
      waitFor({
        callback: ({eventName, payload}) =>
          eventName === player && win.includes(payload), 
      }),
      request({eventName: `${player} Wins`, payload: win}),
    )
    return acc
  }, {})

const enforceTurns = loop(
  strand(
    Object.assign(waitFor({eventName: 'X'}), block({eventName: 'O'})),
    Object.assign(waitFor({eventName: 'O'}), block({eventName: 'X'})),
  ),
)

const playerMove = (player: string) =>
  loop(
    strand({
      request: squares.map(move => ({eventName: player, payload: move})),
    }),
  )

const stopGame = strand(
  waitFor({eventName: 'X Wins'},{eventName: 'O Wins'}),
  block({eventName: 'X'}, {eventName: 'O'}),
)

const strands = {
  stopGame,
  ...squaresTaken,
  enforceTurns,
  ...playerWins('X'),
  ...playerWins('O'),
}

const xStrands = {
  ...strands,
  xMoves: playerMove('X'),
}

const oStrands = {
  ...strands,
  oMoves: playerMove('O'),
}

const {trigger: xTrigger, feedback: xFeedback} = new Track(xStrands, {strategy: randomizedStrategy})

const {trigger: oTrigger, feedback: oFeedback} = new Track(oStrands, {strategy: randomizedStrategy})
const xActions = {
  X(payload: unknown){
    console.log({eventName: 'X', payload})
    oTrigger({
      eventName: 'X',
      payload: payload,
      baseDynamic: baseDynamics.objectObject,
    })
  },
  ['X Wins'](payload: unknown){
    console.log({eventName: 'X Wins', payload})
  },
}
xFeedback(xActions)

const oActions = {
  O(payload: unknown){
    console.log({eventName: 'O', payload})
    xTrigger({
      eventName: 'O',
      payload: payload,
      baseDynamic: baseDynamics.objectObject,
    })
  },
  ['O Wins'](payload: unknown){
    console.log({eventName: 'O Wins', payload})
  },
}
oFeedback(oActions)

xTrigger({eventName: 'start', baseDynamic: baseDynamics.objectObject})
