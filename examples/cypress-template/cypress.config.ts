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
    setupNodeEvents(on, config) {
      return {
        browsers: config.browsers.filter((b) => b.family === 'chromium' && b.name !== 'electron'),
      }
    },
  },
  experimentalWebKitSupport: true,
})
