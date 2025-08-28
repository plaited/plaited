import { type StoryObj } from 'plaited/workshop'
import { Card } from './Card.js'

export const Example: StoryObj = {
  description: 'Basic card',
  template: () => <Card>This is a card</Card>,
}
