import { html } from '@plaited/template'

export const livereloadTemplate = html`<script>
const source = new EventSource('/livereload');
const reload = () => location.reload(true);
source.onmessage = reload;
source.onerror = () => (source.onopen = reload);
console.log('[plaited] listening for file changes');
</script>`
