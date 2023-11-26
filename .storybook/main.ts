import type { StorybookConfig } from '@plaited/storybook-vite'

const config: StorybookConfig = {
  stories: ['../stories/**/*.mdx', '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-links', '@storybook/addon-essentials', '@storybook/addon-interactions'],
  framework: {
    name: '@plaited/storybook-vite',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
}
export default config
