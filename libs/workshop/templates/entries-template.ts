import { html } from '../../islandly/mod.ts'

export const entriesTemplate = (entries: string[]) =>
  html`<script type="module" async>
${
    entries.map((path) => {
      return html`import "/${path}";`
    }).join(' ')
  }
</script>`
