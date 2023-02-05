Argument of type 'typeof ISLElement' is not assignable to parameter of type
'IslandConstructor'. Construct signature return types 'ISLElement' and
'IslandElement' are incompatible. The types of 'plait' are incompatible between
these types. Type

'(($: <T = Element>(id: string) => never[] | T[], context: ISLElement) => {
trigger: TriggerFunc; disconnect: () => void; }) | undefined'

is not assignable to type

'(($: <T = Element>(id: string) => T[] | never[], context: IslandElement) => {
trigger: TriggerFunc; disconnect: () => void; }) | undefined'.

Type '($: <T = Element>(id: string) => never[] | T[], context: ISLElement) => {
trigger: TriggerFunc; disconnect: () => void; }' is not assignable to type '($:
<T = Element>(id: string) => T[] | never[], context: IslandElement) => {
trigger: TriggerFunc; disconnect: () => void; }'. Types of parameters 'context'
and 'context' are incompatible. Type 'IslandElement' is missing the following
properties from type 'ISLElement': #noDeclarativeShadow, connectedCallback,
disconnectedCallback, #delegateListeners, and 3 more.
