import { StoryObj } from "./types.js"

export default import.meta.path

type Story = StoryObj

export const example: Story = {
  render: () => <div>hello</div>,
  attrs: {},
}