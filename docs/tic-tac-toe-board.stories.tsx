import type { StoryObj } from 'plaited/testing'
import { TicTacToeBoard } from './tic-tac-toe-board.js'
import { BoardMarker } from './board-marker.js'
import { OMarker } from './o-marker.js'
import { XMarker } from './x-marker.js'

export const BoardMarkerRender: StoryObj = {
  description: '',
  template: BoardMarker,
}

export const TicTacToeBoardRender: StoryObj = {
  description: '',
  template: TicTacToeBoard,
}

export const OMarkerRender: StoryObj = {
  description: '',
  template: OMarker,
}

export const XMarkerRender: StoryObj = {
  description: '',
  template: XMarker,
}
