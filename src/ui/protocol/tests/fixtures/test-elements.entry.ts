/**
 * Browser entry point for controller test scenarios.
 * Registers multiple test elements, each designed for a specific test category.
 * The fixture server dispatches different WebSocket messages based on element tag.
 */
import { controlIsland } from '../../../dom/control-island.ts'

// Swap mode tests — server sends all 6 swap modes after client_connected
controlIsland({ tag: 'swap-test', observedAttributes: [] })

// Attribute handler tests — server sends attrs messages
controlIsland({ tag: 'attrs-test', observedAttributes: ['value', 'label'] })

// User action tests — server renders p-trigger buttons, captures user_action
controlIsland({ tag: 'action-test', observedAttributes: [] })

// Retry tests — server closes with 1012, client reconnects
controlIsland({ tag: 'retry-test', observedAttributes: [] })

window.dispatchEvent(new CustomEvent('test-elements-ready'))
