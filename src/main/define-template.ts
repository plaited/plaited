import type { Attrs } from '../jsx/jsx.types.js'
import { type GetElementArgs, getElement, type PlaitedHandlers } from './get-element.js'
import { createTemplate } from '../jsx/create-template.js'
import { PLAITED_TEMPLATE_IDENTIFIER, ELEMENT_CALLBACKS } from './plaited.constants.js'
import type { PlaitedTemplate } from './plaited.types.js'

interface DefineTemplateArgs<A extends PlaitedHandlers>
  extends Omit<GetElementArgs<A>, 'delegatesFocus' | 'mode' | 'slotAssignment'> {
  delegatesFocus?: boolean
  mode?: 'open' | 'closed'
  slotAssignment?: 'named' | 'manual'
}
/**
 * Creates a template function for defining Plaited components with built-in SSR support.
 * Combines custom element definition with template generation for server and client rendering.
 *
 * @template A Type extending PlaitedHandlers for component behavior
 * @param config Component configuration with template and behavior
 * @returns Template function with metadata for component registration
 *
 * Features:
 * - Server-side rendering support
 * - Custom element registration
 * - Shadow DOM template generation
 * - Event delegation setup
 * - Attribute observation
 * - Stream mutation support
 *
 * @example
 import type { type FT, defineTemplate, useSignal } from 'plaited'

 const store = useSignal<number>(0)

 const Publisher = defineTemplate({
   tag: 'publisher-component',
   shadowDom: (
     <button
       p-trigger={{ click: 'increment' }}
       p-target='button'
     >
       increment
     </button>
   ),
   publicEvents: ['add'],
   bProgram({ bThreads, bThread, bSync }) {
     bThreads.set({
       onAdd: bThread([bSync({ waitFor: 'add' }), bSync({ request: { type: 'disable' } })]),
     })
     return {
       increment() {
         store.set(store.get() + 1)
       },
     }
   },
 })

 const Subscriber = defineTemplate({
   tag: 'subscriber-component',
   shadowDom: <h1 p-target='count'>{store.get()}</h1>,
   publicEvents: ['update'],
   bProgram({ $, trigger }) {
     store.listen('update', trigger)
     return {
       update(value: number) {
         const [count] = $('count')
         count.render(`${value}`)
       },
     }
   },
 })

 export const Fixture: FT = () => (
   <>
     <Publisher />
     <Subscriber />
   </>
 )

 *
 * @remarks
 * - Generates both client and server templates
 * - Handles declarative shadow DOM
 * - Manages component registration
 * - Provides SSR-compatible output
 * - Maintains type safety
 * - Handles hydration automatically
 *
 * Return Value Properties:
 * - registry: Set of registered child plaited elements tags
 * - tag: Component's custom element tag
 * - $: Template identifier
 * - publicEvents: Available event types
 * - observedAttributes: Observed attribute names
 *
 * Default Configuration:
 * - mode: 'open'
 * - delegatesFocus: true
 * - slotAssignment: 'named'
 */
export const defineTemplate = <A extends PlaitedHandlers>({
  tag,
  shadowDom,
  mode = 'open',
  delegatesFocus = true,
  slotAssignment = 'named',
  publicEvents,
  observedAttributes = [],
  streamAssociated,
  ...rest
}: DefineTemplateArgs<A>): PlaitedTemplate => {
  const events: string[] = [
    ...(publicEvents ?? []),
    ...(streamAssociated ?
      [ELEMENT_CALLBACKS.onAppend, ELEMENT_CALLBACKS.onPrepend, ELEMENT_CALLBACKS.onReplaceChildren]
    : []),
  ]
  getElement<A>({
    tag,
    shadowDom,
    publicEvents: events,
    slotAssignment,
    delegatesFocus,
    mode,
    observedAttributes,
    streamAssociated,
    ...rest,
  })
  const registry = new Set<string>([...shadowDom.registry, tag])
  const ft = ({ children = [], ...attrs }: Attrs) =>
    createTemplate(tag, {
      ...attrs,
      children: [
        createTemplate('template', {
          shadowrootmode: mode,
          shadowrootdelegatesfocus: delegatesFocus,
          children: shadowDom,
        }),
        ...(Array.isArray(children) ? children : [children]),
      ],
    })
  ft.registry = registry
  ft.tag = tag
  ft.$ = PLAITED_TEMPLATE_IDENTIFIER
  ft.publicEvents = events
  ft.observedAttributes = observedAttributes
  return ft
}
