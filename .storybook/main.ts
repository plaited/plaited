import type { StorybookConfig } from '@plaited/storybook-vite'

const config: StorybookConfig = {
  stories: ['../**/libs/**/*.stories.@(ts|tsx)', '../stories/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-interactions'],
  framework: {
    name: '@plaited/storybook-vite',
    options: {},
  },
}
export default config
