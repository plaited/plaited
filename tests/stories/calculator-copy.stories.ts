import { Story, StoryConfig } from '$plaited'
import { CalculatorTemplate } from './calculator.template.ts'

export default {
  title: 'test/copy',
  template: CalculatorTemplate,
  description:
    'Example of using Island Template template and workers to exercise the islandly library',
} as StoryConfig

export const CalculatorCopy: Story = {
  description: 'a calculator cosisting of two islands and worker',
  play(_, t) {
    t.ok(false)
  },
}
