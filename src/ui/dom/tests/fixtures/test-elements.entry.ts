/**
 * Browser entry point for controller test scenarios.
 * The fixture server dispatches different WebSocket messages based on source.
 */
import { controlDocument } from '../../../dom/control-document.ts'

controlDocument()

window.dispatchEvent(new CustomEvent('test-elements-ready'))
