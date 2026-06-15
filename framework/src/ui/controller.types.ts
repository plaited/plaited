/**
 * Types for controller module imports.
 *
 * @remarks
 * Controller islands can import dynamic modules at runtime. Each module must
 * export a default function matching {@link ControllerModule} that receives a
 * {@link ControllerModuleContext} with controller primitives for event wiring,
 * listener delegation, and error reporting.
 *
 * @see {@link ControllerModule}
 * @see {@link ControllerModuleContext}
 */

import type { Disconnect, JsonObject, Trigger } from '../behavioral.ts'
import type { DelegatedListener } from './delegated-listener.ts'
