/**
 * Browser entry point for controller test scenarios.
 * The fixture server dispatches different WebSocket messages based on source.
 */
import { controlIsland } from '../../control-island.ts'

controlIsland('swap-test')
controlIsland('attrs-test')
controlIsland('action-test')
controlIsland('retry-test')
controlIsland('bad-import-test')
controlIsland('unsupported-event-test')

window.dispatchEvent(new CustomEvent('test-elements-ready'))
