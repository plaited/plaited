/**
 * Browser entry point for document runtime tests.
 * Bundled by Bun.build() and served as a script in the HTML fixture.
 */
import { controlDocument } from '../../../dom/control-document.ts'

controlDocument()

window.dispatchEvent(new CustomEvent('test-island-ready', { detail: { tag: 'test-island' } }))
