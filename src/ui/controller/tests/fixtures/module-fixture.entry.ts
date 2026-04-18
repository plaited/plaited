/**
 * Browser entry point for testing imported controller modules.
 */
import { controlIsland } from '../../control-island.ts'

controlIsland('module-fixture')

window.dispatchEvent(new CustomEvent('module-fixture-ready'))
