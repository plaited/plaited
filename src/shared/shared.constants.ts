import { keyMirror } from '../utils.ts'

/**
 * Event keys used for messages emitted by the behavioral engine to the browser
 * controller.
 *
 * @public
 */
export const SERVER_TO_CONTROLLER_EVENTS = keyMirror('attrs', 'render', 'dispatch_custom_event', 'navigate')

/**
 * Event keys used for messages emitted by the browser controller to the
 * behavioral engine.
 *
 * @public
 */
export const CONTROLLER_TO_SERVER_EVENTS = keyMirror('ui_event', 'error', 'form_submit', 'success', 'snapshot')

/**
 * Supported DOM insertion modes for `render` protocol messages.
 *
 * @remarks
 * These values align with the insertion positions accepted by the controller's
 * DOM update path, plus `innerHTML` and `outerHTML` replacement modes.
 *
 * @public
 */
export const SWAP_MODES = keyMirror('afterbegin', 'afterend', 'beforebegin', 'beforeend', 'innerHTML', 'outerHTML')

export const PAGE_EVENTS = keyMirror('pagereveal', 'pageswap', 'pagehide', 'pageshow')

export const P_FORM_TRIGGER = 'p-form-trigger'

export const FLOW_CONTROL_HELPERS = keyMirror(
  'val',
  'for',
  'switch',
  'case',
  'default',
  'with',
  'slot',
  'token',
  'keyframe',
)

/**
 * Pattern matching a token reference embedded in a CSS value.
 * Agent-inserted comment markers: `/* $token <id> *​/`
 *
 * @remarks
 * The `$token` identifier is pulled from {@link FLOW_CONTROL_HELPERS} so the
 * marker and the matcher share a single source of truth.
 *
 * @public
 */
export const TOKEN_REF_PATTERN = new RegExp(String.raw`/\*\s*\$${FLOW_CONTROL_HELPERS.token}\s+(\S+)\s*\*/`)

/**
 * Pattern matching a keyframe reference embedded in a CSS value.
 * Agent-inserted comment markers: `/* $keyframe <id> *​/`
 *
 * @remarks
 * The `$keyframe` identifier is pulled from {@link FLOW_CONTROL_HELPERS} so the
 * marker and the matcher share a single source of truth.
 *
 * @public
 */
export const KEYFRAME_REF_PATTERN = new RegExp(String.raw`/\*\s*\$${FLOW_CONTROL_HELPERS.keyframe}\s+(\S+)\s*\*/`)

/**
 * Patterns matching flow-control opening markers embedded in rendered HTML.
 * Each captures the marker id in group 1.
 *
 * @remarks
 * Markers are emitted by `getFlowControlPrefixMarker` +
 * `getFlowControlIdMarker` in `src/client/template.ts`. The helper name is
 * interpolated from {@link FLOW_CONTROL_HELPERS} so markers and matchers share
 * a single source of truth. `\s*` between the name and id accommodates both
 * `$val` (which inserts a space) and the `$for`/`$switch`/... wrappers (which
 * join the prefix and id markers without a separator).
 *
 * @public
 */
export const FLOW_CONTROL_VAL_PATTERN = new RegExp(String.raw`<!--\?\s${FLOW_CONTROL_HELPERS.val}\s*(\S+)\s*-->`)
export const FLOW_CONTROL_FOR_PATTERN = new RegExp(String.raw`<!--\?\s${FLOW_CONTROL_HELPERS.for}\s*(\S+)\s*-->`)
export const FLOW_CONTROL_SWITCH_PATTERN = new RegExp(String.raw`<!--\?\s${FLOW_CONTROL_HELPERS.switch}\s*(\S+)\s*-->`)
export const FLOW_CONTROL_CASE_PATTERN = new RegExp(String.raw`<!--\?\s${FLOW_CONTROL_HELPERS.case}\s*(\S+)\s*-->`)
export const FLOW_CONTROL_DEFAULT_PATTERN = new RegExp(
  String.raw`<!--\?\s${FLOW_CONTROL_HELPERS.default}\s*(\S+)\s*-->`,
)
export const FLOW_CONTROL_WITH_PATTERN = new RegExp(String.raw`<!--\?\s${FLOW_CONTROL_HELPERS.with}\s*(\S+)\s*-->`)
export const FLOW_CONTROL_SLOT_PATTERN = new RegExp(String.raw`<!--\?\s${FLOW_CONTROL_HELPERS.slot}\s*(\S+)\s*-->`)

/**
 * Patterns matching flow-control closing markers embedded in rendered HTML.
 *
 * @remarks
 * Markers are emitted by `getFlowControlSuffixMarket` in
 * `src/client/template.ts`. The helper name is interpolated from
 * {@link FLOW_CONTROL_HELPERS} so markers and matchers share a single source
 * of truth. `val` has no closing marker (it is self-closing).
 *
 * @public
 */
export const FLOW_CONTROL_FOR_END_PATTERN = new RegExp(String.raw`<!--\?\s*end-${FLOW_CONTROL_HELPERS.for}\s*-->`)
export const FLOW_CONTROL_SWITCH_END_PATTERN = new RegExp(String.raw`<!--\?\s*end-${FLOW_CONTROL_HELPERS.switch}\s*-->`)
export const FLOW_CONTROL_CASE_END_PATTERN = new RegExp(String.raw`<!--\?\s*end-${FLOW_CONTROL_HELPERS.case}\s*-->`)
export const FLOW_CONTROL_DEFAULT_END_PATTERN = new RegExp(
  String.raw`<!--\?\s*end-${FLOW_CONTROL_HELPERS.default}\s*-->`,
)
export const FLOW_CONTROL_WITH_END_PATTERN = new RegExp(String.raw`<!--\?\s*end-${FLOW_CONTROL_HELPERS.with}\s*-->`)
export const FLOW_CONTROL_SLOT_END_PATTERN = new RegExp(String.raw`<!--\?\s*end-${FLOW_CONTROL_HELPERS.slot}\s*-->`)
