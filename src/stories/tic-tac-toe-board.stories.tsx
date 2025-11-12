import { story } from 'plaited/testing'
import { TicTacToeBoard } from './tic-tac-toe-board.js'
import { BoardMarker } from './board-marker.js'
import { OMarker } from './o-marker.js'
import { XMarker } from './x-marker.js'

export const BoardMarkerRender = story<typeof BoardMarker>({
  description: '',
  template: BoardMarker,
})

export const TicTacToeBoardRender = story<typeof TicTacToeBoard>({
  description: '',
  template: TicTacToeBoard,
})

export const OMarkerRender = story<typeof OMarker>({
  description: '',
  template: OMarker,
})

export const XMarkerRender = story<typeof XMarker>({
  description: '',
  template: XMarker,
})
