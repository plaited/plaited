const url = '`ws://${host}/livereload`'
export const livereloadTemplate = `<script type="text/javascript">
const hostRegex = /^https?:\\/\\/([^\\/]+)\\/.*$/i;
const host = document.URL.replace(hostRegex, '$1');
const socket = new WebSocket(${url});
const reload = () =>{
  location.reload();
  console.log('...reloading');
};
socket.addEventListener('message', reload);
console.log('[plaited] listening for file changes');
</script>`
