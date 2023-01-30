import { html } from '../template.ts'

export const livereloadTemplate = html`<script>
const sse = new EventSource('/livereload');
sse.addEventListener("message", (e) => {
  console.log(e.data)
});
</script>`
