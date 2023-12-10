import type { Preview } from '@plaited/storybook'
import { createFragment } from '@plaited/storybook-utils'

const preview: Preview = {
  decorators: [],
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
}

export default preview
