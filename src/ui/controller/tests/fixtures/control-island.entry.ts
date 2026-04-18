/**
 * Browser entry point for controller island runtime tests.
 */
import { controlIsland } from '../../control-island.ts'

controlIsland('test-island')

window.dispatchEvent(new CustomEvent('test-island-ready', { detail: { tag: 'test-island' } }))
