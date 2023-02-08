import { html } from '../island/mod.ts'

export const livereloadTemplate = html`<script type="text/javascript">
const source = new EventSource('/livereload');
const reload = () => location.reload(true);
source.onmessage = reload;
source.onerror = () => (source.onopen = reload);
console.log('[plaited] listening for file changes');
</script>`
