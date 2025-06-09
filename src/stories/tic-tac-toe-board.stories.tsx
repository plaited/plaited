import { type StoryObj, STORY_PURPOSE } from 'plaited/workshop'
import { TicTacToeBoard } from './tic-tac-toe-board.js'
import { BoardMarker } from './board-marker.js'
import { OMarker } from './o-marker.js'
import { XMarker } from './x-marker.js'

export const BoardMarkerRender: StoryObj = {
  description: '',
  template: BoardMarker,
  parameters: {
    purpose: STORY_PURPOSE.demo,
  },
}

export const TicTacToeBoardRender: StoryObj = {
  description: '',
  template: TicTacToeBoard,
  parameters: {
    purpose: STORY_PURPOSE.demo,
  },
}

export const OMarkerRender: StoryObj = {
  description: '',
  template: OMarker,
  parameters: {
    purpose: STORY_PURPOSE.demo,
  },
}

export const XMarkerRender: StoryObj = {
  description: '',
  template: XMarker,
  parameters: {
    purpose: STORY_PURPOSE.demo,
  },
}
