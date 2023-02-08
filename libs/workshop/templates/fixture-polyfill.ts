import { fixture } from '../constants.ts'
import { html } from '../../island/mod.ts'

export const fixturePolyfill = html`<script type="text/javascript">
(function attachFixtureShadow(root) {
  const template = document.querySelector("${fixture}")
  const mode = template.getAttribute("shadowroot")
  const shadowRoot = template.parentNode.attachShadow({ mode })
  shadowRoot.appendChild(template.content)
  template.remove()
  attachFixtureShadow(shadowRoot)
})(document)
</script>`
