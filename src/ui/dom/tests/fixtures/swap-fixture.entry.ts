/**
 * Browser entry point for testing setHTMLUnsafe with declarative shadow DOM.
 * The server sends a render message containing <template shadowrootmode="open">.
 */
import { controlDocument } from '../../../dom/control-document.ts'

controlDocument()

window.dispatchEvent(new CustomEvent('swap-fixture-ready'))
