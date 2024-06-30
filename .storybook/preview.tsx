import { Preview } from '@plaited/storybook'

const preview: Preview = {
  decorators: [
    (Story) => (
      <div style={{ margin: '3em' }}>
        {' '}
        <Story />
      </div>
    ),
  ],
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
