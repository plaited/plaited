import { TicTacToeBoard } from './tic-tac-toe-board.js'
import { Meta, StoryObj } from '@plaited/storybook'
// More on how to set up stories at: https://storybook.js.org/docs/preact/writing-stories/introduction
const meta: Meta<typeof TicTacToeBoard> = {
  title: 'Example/TicTacToeBoard',
  component: TicTacToeBoard,
}

export default meta
type Story = StoryObj<typeof TicTacToeBoard>

export const Render: Story = {}
