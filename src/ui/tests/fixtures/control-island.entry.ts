/**
 * Browser entry point for controlIsland tests.
 * Bundled by Bun.build() and served as a script in the HTML fixture.
 */
import { controlIsland } from '../../control-island.ts'

const TestIsland = controlIsland({
  tag: 'test-island',
  observedAttributes: ['value', 'label'],
})

// Signal to the test that the module has loaded and the element is registered
window.dispatchEvent(new CustomEvent('test-island-ready', { detail: { tag: TestIsland.tag } }))
