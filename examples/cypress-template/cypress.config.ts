import { defineConfig } from 'cypress'

export default defineConfig({
  component: {
    includeShadowDom: true,
    supportFile: 'cypress/support/component.ts',
    devServer: {
      bundler: 'vite',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      framework: '@plaited/cypress-ct' as any,
    },
    indexHtmlFile: './component-index.html',
  },
  experimentalWebKitSupport: true,
})