import { html, template, wire } from '$plaited'
import { Story, StoryConfig } from '../../../types.ts'

const ExampleField = template<{ value: number }>((attrs) =>
  html`<input type='text' ${wire(attrs)}
   min="10" max="100"
  ref={ref}
/>`
)

export default {
  title: 'Components/ExampleField',
  template: ExampleField,
  island: 'example-field',
  description: 'test button to verify this workshop works',
} as StoryConfig<{ value: number }>

export const FieldBasic: Story<{ value: number }> = {
  args: {
    value: 100,
    id: 'input',
  },
  description: 'test description of textfield story',
  play: async ({ page, expect }) => {
    await page.locator('#input').fill('1')
    await expect(page.locator('#input')).toBe('1')
  },
}
