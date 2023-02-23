import { Story, StoryConfig } from '$plaited'
import { CalculatorTemplate } from './calculator.template.ts'

export default {
  title: 'examples/calculator',
  template: CalculatorTemplate,
  description:
    'Example of using Island Template template and workers to exercise the islandly library',
} as StoryConfig

export const Calculator: Story = {
  description: 'a calculator consisting of two islands and worker',
}
