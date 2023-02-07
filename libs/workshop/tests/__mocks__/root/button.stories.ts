import { html, template, wire } from '../../../../island/mod.ts'
import { Story, StoryConfig } from '../../../types.ts'

const Button = template<{ children: string }>(({ children, ...attrs }) =>
  html`<button  ${wire(attrs)}>${children}</button>`
)

export default {
  title: 'Components/Button',
  template: Button,
  island: 'test-fixture',
  description: 'test button to verify this workshop works',
} as StoryConfig<{ children: string }>

export const BasicButton: Story<{ children: string }> = {
  description: 'basic button for test',
  args: {
    type: 'submit',
    children: 'basic',
  },
}
