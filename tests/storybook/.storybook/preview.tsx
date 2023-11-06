import type { Preview } from "@plaited/storybook";

const preview: Preview = {
  decorators: [
    (Story, ...args) => {
      console.log(args)
      console.log('hit decorator')
      return (
      <div style={{ margin: '3em' }}>
        <Story />
      </div>
    )},
  ],
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
