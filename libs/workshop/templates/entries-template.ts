import { html } from '../../islandly/mod.ts'

export const entriesTemplate = (entries: string[]) =>
  html`<script type="module">
${
    entries.map((path) => {
      return html`import "/${path}";`
    }).join(' ')
  }
</script>`
