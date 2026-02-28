/**
 * Browser entry point for testing update_behavioral.
 * The server sends an update_behavioral message after client_connected,
 * the controller imports the module and registers threads/handlers.
 */
import { controlIsland } from '../../../dom/control-island.ts'

controlIsland({
  tag: 'behavioral-fixture',
  observedAttributes: [],
})

window.dispatchEvent(new CustomEvent('behavioral-fixture-ready'))
