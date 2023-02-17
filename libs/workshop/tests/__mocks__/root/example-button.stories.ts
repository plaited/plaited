import { html, template, wire } from '$plaited'
import { Story, StoryConfig } from '../../../types.ts'

const ExampleButton = template<{ children: string }>(({ children, ...attrs }) =>
  html`<button  ${wire(attrs)}>${children}</button>`
)

export default {
  title: 'Components/ExampleButton',
  template: ExampleButton,
  description: 'test button to verify this workshop works',
} as StoryConfig<{ children: string }>

export const BasicButton: Story<{ children: string }> = {
  description: 'basic button for test',
  args: {
    type: 'submit',
    children: 'basic',
  },
}
