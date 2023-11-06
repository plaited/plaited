import type { Preview } from "@plaited/storybook";
import { createFragment } from "@plaited/storybook";

const preview: Preview = {
  decorators: [
    (Story, ...args) => {
      const frag = createFragment(<div style={{ margin: '3em' }}></div>)
      frag.firstElementChild.append(Story())
      return frag
    },
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
