/**
 * Browser entry point for testing update_behavioral.
 * The server sends an update_behavioral message after root_connected,
 * the controller imports the module and sends behavioral_updated.
 */
import { controlIsland } from '../../control-island.ts'

controlIsland({
  tag: 'behavioral-fixture',
  observedAttributes: [],
})

window.dispatchEvent(new CustomEvent('behavioral-fixture-ready'))
