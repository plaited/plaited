export const fragment = (...tpl) => {
  const template = document.createElement('template')
  template.innerHTML = tpl.filter(Boolean).join('')
  return template.content.cloneNode(true)
}
