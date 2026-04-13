/**
 * Browser entry point for testing legacy update_behavioral compatibility mode.
 */
import { controlIsland } from '../../../dom/control-island.ts'

controlIsland({
  tag: 'behavioral-legacy-fixture',
  observedAttributes: [],
})

window.dispatchEvent(new CustomEvent('behavioral-legacy-fixture-ready'))
