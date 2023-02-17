import { html } from '../../islandly/mod.ts'

export const registriesTemplate = (registries: string[]) =>
  html`<script type="module" async>
${
    registries.map((path) => {
      return html`import "/${path}";`
    }).join(' ')
  }
</script>`
