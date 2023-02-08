import { html, template, wire } from '../../../../island/mod.ts'
import { Story, StoryConfig } from '../../../types.ts'

const NumberField = template<{ value: number }>((attrs) =>
  html`<input type='text' ${wire(attrs)}
   min="10" max="100"
  ref={ref}
/>`
)

export default {
  title: 'Components/NumberField',
  template: NumberField,
  island: 'test-fixture',
  description: 'test button to verify this workshop works',
} as StoryConfig<{ value: number }>

export const NumberFieldBasic: Story<{ value: number }> = {
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
