/**
 * Browser entry point for testing update_behavioral -> update_extension wiring.
 */
import { controlDocument } from '../../../dom/control-document.ts'

controlDocument()

window.dispatchEvent(new CustomEvent('behavioral-fixture-ready'))
