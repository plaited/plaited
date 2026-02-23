/**
 * Browser entry point for testing setHTMLUnsafe with declarative shadow DOM.
 * The server sends a render message containing <template shadowrootmode="open">.
 */
import { controlIsland } from '../../control-island.ts'

controlIsland({
  tag: 'swap-fixture',
  observedAttributes: [],
})

window.dispatchEvent(new CustomEvent('swap-fixture-ready'))
