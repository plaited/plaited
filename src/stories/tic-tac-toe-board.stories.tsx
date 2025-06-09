import { type StoryObj, STORY_USAGE } from 'plaited/workshop'
import { TicTacToeBoard } from './tic-tac-toe-board.js'
import { BoardMarker } from './board-marker.js'
import { OMarker } from './o-marker.js'
import { XMarker } from './x-marker.js'

export const BoardMarkerRender: StoryObj = {
  description: '',
  template: BoardMarker,
  parameters: {
    usage: STORY_USAGE.doc,
  },
}

export const TicTacToeBoardRender: StoryObj = {
  description: '',
  template: TicTacToeBoard,
  parameters: {
    usage: STORY_USAGE.doc,
  },
}

export const OMarkerRender: StoryObj = {
  description: '',
  template: OMarker,
  parameters: {
    usage: STORY_USAGE.doc,
  },
}

export const XMarkerRender: StoryObj = {
  description: '',
  template: XMarker,
  parameters: {
    usage: STORY_USAGE.doc,
  },
}
