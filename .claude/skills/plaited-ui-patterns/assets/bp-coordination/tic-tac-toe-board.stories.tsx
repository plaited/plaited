import { story } from 'plaited/testing'
import { BoardMarker } from './board-marker.tsx'
import { OMarker } from './o-marker.tsx'
import { TicTacToeBoard } from './tic-tac-toe-board.tsx'
import { XMarker } from './x-marker.tsx'

export const BoardMarkerRender = story<typeof BoardMarker>({
  intent: '',
  template: BoardMarker,
})

export const TicTacToeBoardRender = story<typeof TicTacToeBoard>({
  intent: '',
  template: TicTacToeBoard,
})

export const OMarkerRender = story<typeof OMarker>({
  intent: '',
  template: OMarker,
})

export const XMarkerRender = story<typeof XMarker>({
  intent: '',
  template: XMarker,
})
