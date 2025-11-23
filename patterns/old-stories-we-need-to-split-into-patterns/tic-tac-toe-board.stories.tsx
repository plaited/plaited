import { story } from 'plaited/testing.ts'
import { BoardMarker } from './board-marker.tsx'
import { OMarker } from './o-marker.tsx'
import { TicTacToeBoard } from './tic-tac-toe-board.tsx'
import { XMarker } from './x-marker.tsx'

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
