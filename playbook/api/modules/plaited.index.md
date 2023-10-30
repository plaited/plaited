[Plaited Typedocs](../README.md) / [Exports](../modules.md) / [plaited](plaited.md) / index

# Module: index

## Table of contents

### References

- [h](plaited.index.md#h)

### Interfaces

- [$](../interfaces/plaited.index._.md)
- [AdditionalAttrs](../interfaces/plaited.index.AdditionalAttrs.md)
- [Connect](../interfaces/plaited.index.Connect.md)
- [CreateTemplate](../interfaces/plaited.index.CreateTemplate.md)
- [DevCallback](../interfaces/plaited.index.DevCallback.md)
- [PlaitedElement](../interfaces/plaited.index.PlaitedElement.md)
- [PlaitedElementConstructor](../interfaces/plaited.index.PlaitedElementConstructor.md)
- [StateSnapshot](../interfaces/plaited.index.StateSnapshot.md)

### Type Aliases

- [Attrs](plaited.index.md#attrs)
- [BaseAttrs](plaited.index.md#baseattrs)
- [CandidateBid](plaited.index.md#candidatebid)
- [Child](plaited.index.md#child)
- [Children](plaited.index.md#children)
- [ComponentArgs](plaited.index.md#componentargs)
- [Detail](plaited.index.md#detail)
- [FT](plaited.index.md#ft)
- [Feedback](plaited.index.md#feedback)
- [FunctionTemplate](plaited.index.md#functiontemplate)
- [Log](plaited.index.md#log)
- [Message](plaited.index.md#message)
- [ParameterIdiom](plaited.index.md#parameteridiom)
- [PendingBid](plaited.index.md#pendingbid)
- [PlaitProps](plaited.index.md#plaitprops)
- [Primitive](plaited.index.md#primitive)
- [RequestIdiom](plaited.index.md#requestidiom)
- [RuleSet](plaited.index.md#ruleset)
- [RulesFunc](plaited.index.md#rulesfunc)
- [RunningBid](plaited.index.md#runningbid)
- [SelectedMessage](plaited.index.md#selectedmessage)
- [SelectorMod](plaited.index.md#selectormod)
- [Send](plaited.index.md#send)
- [SnapshotMessage](plaited.index.md#snapshotmessage)
- [Strategy](plaited.index.md#strategy)
- [Template](plaited.index.md#template)
- [Trigger](plaited.index.md#trigger)
- [TriggerArgs](plaited.index.md#triggerargs)

### Variables

- [booleanAttrs](plaited.index.md#booleanattrs)
- [dataAddress](plaited.index.md#dataaddress)
- [dataTarget](plaited.index.md#datatarget)
- [dataTrigger](plaited.index.md#datatrigger)
- [primitives](plaited.index.md#primitives)
- [validPrimitiveChildren](plaited.index.md#validprimitivechildren)
- [voidTags](plaited.index.md#voidtags)

### Functions

- [Component](plaited.index.md#component)
- [Fragment](plaited.index.md#fragment)
- [bProgram](plaited.index.md#bprogram)
- [classNames](plaited.index.md#classnames)
- [createTemplate](plaited.index.md#createtemplate)
- [css](plaited.index.md#css)
- [loop](plaited.index.md#loop)
- [memo](plaited.index.md#memo)
- [stylesheets](plaited.index.md#stylesheets)
- [sync](plaited.index.md#sync)
- [thread](plaited.index.md#thread)
- [useIndexedDB](plaited.index.md#useindexeddb)
- [useMain](plaited.index.md#usemain)
- [useMessenger](plaited.index.md#usemessenger)
- [useStore](plaited.index.md#usestore)

## References

### h

Renames and re-exports [createTemplate](plaited.index.md#createtemplate)

## Type Aliases

### Attrs

Ƭ **Attrs**<`T`\>: [`BaseAttrs`](plaited.index.md#baseattrs) & `T`

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`AdditionalAttrs`](../interfaces/plaited.index.AdditionalAttrs.md) = [`AdditionalAttrs`](../interfaces/plaited.index.AdditionalAttrs.md) |

#### Defined in

libs/jsx/dist/types.d.ts:30

___

### BaseAttrs

Ƭ **BaseAttrs**: `Object`

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `children?` | [`Children`](plaited.index.md#children) | - |
| `class?` | `never` | - |
| `className?` | `string` | - |
| `data-address?` | `string` | - |
| `data-target?` | `string` | - |
| `data-trigger?` | `Record`<`string`, `string`\> | - |
| `for?` | `never` | - |
| `htmlFor?` | `string` | - |
| `key?` | `string` | - |
| `shadowrootdelegatesfocus?` | `boolean` | - |
| `shadowrootmode?` | ``"open"`` \| ``"closed"`` | - |
| `slots?` | [`Children`](plaited.index.md#children) | - |
| `style?` | `Record`<`string`, `string`\> | - |
| `stylesheet?` | `string` \| `string`[] | - |
| `trusted?` | `boolean` | setting trusted to true will disable all escaping security policy measures for this element template |

#### Defined in

libs/jsx/dist/types.d.ts:12

___

### CandidateBid

Ƭ **CandidateBid**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `cb?` | `Callback` |
| `detail?` | [`Detail`](plaited.index.md#detail) |
| `priority` | `number` |
| `type` | `string` |

#### Defined in

libs/behavioral/dist/types.d.ts:52

___

### Child

Ƭ **Child**: `string` \| [`Template`](plaited.index.md#template)

#### Defined in

libs/jsx/dist/types.d.ts:7

___

### Children

Ƭ **Children**: [`Child`](plaited.index.md#child)[] \| [`Child`](plaited.index.md#child)

#### Defined in

libs/jsx/dist/types.d.ts:8

___

### ComponentArgs

Ƭ **ComponentArgs**: `Object`

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `connect?` | [`Connect`](../interfaces/plaited.index.Connect.md) | Messenger connect callback from useMessenger |
| `delegatesFocus?` | `boolean` | configure whether to delegate focus or not **`Default Value`** ```ts 'true' ``` |
| `dev?` | ``true`` \| [`DevCallback`](../interfaces/plaited.index.DevCallback.md) | logger function to receive messages from behavioral program react streams |
| `mode?` | ``"open"`` \| ``"closed"`` | define wether island's custom element is open or closed. **`Default Value`** ```ts 'open' ``` |
| `observedTriggers?` | `Record`<`string`, `string`\> | the element tag you want to use |
| `strategy?` | [`Strategy`](plaited.index.md#strategy) | event selection strategy callback from behavioral library |
| `tag` | \`${string}-${string}\` | PlaitedComponent tag name |
| `template` | [`Template`](plaited.index.md#template) | Optional Plaited Component shadow dom template |

#### Defined in

libs/component/dist/types.d.ts:58

___

### Detail

Ƭ **Detail**: `unknown` \| () => `unknown` \| `Event`

#### Defined in

libs/behavioral/dist/types.d.ts:13

___

### FT

Ƭ **FT**<`T`\>: [`FunctionTemplate`](plaited.index.md#functiontemplate)<`T`\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `Record`<`string`, `any`\> = `Record`<`string`, `any`\> |

#### Defined in

libs/jsx/dist/types.d.ts:32

___

### Feedback

Ƭ **Feedback**: <T\>(`actions`: `Actions`<`T`\>) => `void`

#### Type declaration

▸ <`T`\>(`actions`): `void`

##### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `Record`<`string`, (`detail`: `any`) => `void`\> |

##### Parameters

| Name | Type |
| :------ | :------ |
| `actions` | `Actions`<`T`\> |

##### Returns

`void`

#### Defined in

libs/behavioral/dist/types.d.ts:62

___

### FunctionTemplate

Ƭ **FunctionTemplate**<`T`\>: (`attrs`: `T` & [`BaseAttrs`](plaited.index.md#baseattrs)) => [`Template`](plaited.index.md#template)

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `Record`<`string`, `any`\> = `Record`<`string`, `any`\> |

#### Type declaration

▸ (`attrs`): [`Template`](plaited.index.md#template)

##### Parameters

| Name | Type |
| :------ | :------ |
| `attrs` | `T` & [`BaseAttrs`](plaited.index.md#baseattrs) |

##### Returns

[`Template`](plaited.index.md#template)

#### Defined in

libs/jsx/dist/types.d.ts:31

___

### Log

Ƭ **Log**: `ReturnType`<[`StateSnapshot`](../interfaces/plaited.index.StateSnapshot.md)\>

#### Defined in

libs/behavioral/dist/types.d.ts:66

___

### Message

Ƭ **Message**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `detail` | [`TriggerArgs`](plaited.index.md#triggerargs) |
| `recipient` | `string` |

#### Defined in

libs/component/dist/types.d.ts:9

___

### ParameterIdiom

Ƭ **ParameterIdiom**<`T`\>: { `cb?`: `Callback`<`T`\> ; `type`: `string`  } \| { `cb`: `Callback`<`T`\> ; `type?`: `string`  }

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`Detail`](plaited.index.md#detail) = [`Detail`](plaited.index.md#detail) |

#### Defined in

libs/behavioral/dist/types.d.ts:28

___

### PendingBid

Ƭ **PendingBid**: [`RuleSet`](plaited.index.md#ruleset) & [`RunningBid`](plaited.index.md#runningbid)

#### Defined in

libs/behavioral/dist/types.d.ts:51

___

### PlaitProps

Ƭ **PlaitProps**: { `$`: [`$`](../interfaces/plaited.index._.md) ; `host`: [`PlaitedElement`](../interfaces/plaited.index.PlaitedElement.md)  } & `ReturnType`<typeof [`bProgram`](plaited.index.md#bprogram)\>

#### Defined in

libs/component/dist/types.d.ts:39

___

### Primitive

Ƭ **Primitive**: ``null`` \| `undefined` \| `number` \| `string` \| `boolean` \| `bigint`

#### Defined in

libs/jsx/dist/types.d.ts:2

___

### RequestIdiom

Ƭ **RequestIdiom**<`T`\>: `Object`

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`Detail`](plaited.index.md#detail) = [`Detail`](plaited.index.md#detail) |

#### Type declaration

| Name | Type |
| :------ | :------ |
| `detail?` | `T` |
| `type` | `string` |

#### Defined in

libs/behavioral/dist/types.d.ts:35

___

### RuleSet

Ƭ **RuleSet**<`T`\>: `Object`

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`Detail`](plaited.index.md#detail) = [`Detail`](plaited.index.md#detail) |

#### Type declaration

| Name | Type |
| :------ | :------ |
| `block?` | [`ParameterIdiom`](plaited.index.md#parameteridiom)<`T`\> \| [`ParameterIdiom`](plaited.index.md#parameteridiom)<`T`\>[] |
| `request?` | [`RequestIdiom`](plaited.index.md#requestidiom)<`T`\> \| [`RequestIdiom`](plaited.index.md#requestidiom)<`T`\>[] |
| `waitFor?` | [`ParameterIdiom`](plaited.index.md#parameteridiom)<`T`\> \| [`ParameterIdiom`](plaited.index.md#parameteridiom)<`T`\>[] |

#### Defined in

libs/behavioral/dist/types.d.ts:39

___

### RulesFunc

Ƭ **RulesFunc**<`T`\>: () => `IterableIterator`<[`RuleSet`](plaited.index.md#ruleset)<`T`\>\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`Detail`](plaited.index.md#detail) = [`Detail`](plaited.index.md#detail) |

#### Type declaration

▸ (): `IterableIterator`<[`RuleSet`](plaited.index.md#ruleset)<`T`\>\>

##### Returns

`IterableIterator`<[`RuleSet`](plaited.index.md#ruleset)<`T`\>\>

#### Defined in

libs/behavioral/dist/types.d.ts:44

___

### RunningBid

Ƭ **RunningBid**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `generator` | `IterableIterator`<[`RuleSet`](plaited.index.md#ruleset)\> |
| `priority` | `number` |
| `thread` | `string` |
| `trigger?` | ``true`` |

#### Defined in

libs/behavioral/dist/types.d.ts:45

___

### SelectedMessage

Ƭ **SelectedMessage**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `detail?` | [`Detail`](plaited.index.md#detail) |
| `type` | `string` |

#### Defined in

libs/behavioral/dist/types.d.ts:15

___

### SelectorMod

Ƭ **SelectorMod**: ``"="`` \| ``"~="`` \| ``"|="`` \| ``"^="`` \| ``"$="`` \| ``"*="``

#### Defined in

libs/component/dist/types.d.ts:13

___

### Send

Ƭ **Send**: (`recipient`: `string`, `detail`: [`TriggerArgs`](plaited.index.md#triggerargs)) => `void`

#### Type declaration

▸ (`recipient`, `detail`): `void`

##### Parameters

| Name | Type |
| :------ | :------ |
| `recipient` | `string` |
| `detail` | [`TriggerArgs`](plaited.index.md#triggerargs) |

##### Returns

`void`

#### Defined in

libs/component/dist/types.d.ts:8

___

### SnapshotMessage

Ƭ **SnapshotMessage**: `ReturnType`<[`StateSnapshot`](../interfaces/plaited.index.StateSnapshot.md)\>

#### Defined in

libs/behavioral/dist/types.d.ts:14

___

### Strategy

Ƭ **Strategy**: (`filteredEvents`: [`CandidateBid`](plaited.index.md#candidatebid)[] \| `never`[]) => [`CandidateBid`](plaited.index.md#candidatebid) \| `undefined`

#### Type declaration

▸ (`filteredEvents`): [`CandidateBid`](plaited.index.md#candidatebid) \| `undefined`

##### Parameters

| Name | Type |
| :------ | :------ |
| `filteredEvents` | [`CandidateBid`](plaited.index.md#candidatebid)[] \| `never`[] |

##### Returns

[`CandidateBid`](plaited.index.md#candidatebid) \| `undefined`

#### Defined in

libs/behavioral/dist/types.d.ts:58

___

### Template

Ƭ **Template**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `content` | `string` |
| `stylesheets` | `Set`<`string`\> |

#### Defined in

libs/jsx/dist/types.d.ts:3

___

### Trigger

Ƭ **Trigger**: <T\>(`args`: [`TriggerArgs`](plaited.index.md#triggerargs)<`T`\>) => `void`

#### Type declaration

▸ <`T`\>(`args`): `void`

##### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`Detail`](plaited.index.md#detail) = [`Detail`](plaited.index.md#detail) |

##### Parameters

| Name | Type |
| :------ | :------ |
| `args` | [`TriggerArgs`](plaited.index.md#triggerargs)<`T`\> |

##### Returns

`void`

#### Defined in

libs/behavioral/dist/types.d.ts:19

___

### TriggerArgs

Ƭ **TriggerArgs**<`T`\>: `Object`

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`Detail`](plaited.index.md#detail) = [`Detail`](plaited.index.md#detail) |

#### Type declaration

| Name | Type |
| :------ | :------ |
| `detail?` | `T` |
| `type` | `string` |

#### Defined in

libs/behavioral/dist/types.d.ts:20

## Variables

### booleanAttrs

• `Const` **booleanAttrs**: `Set`<`string`\>

boolean attributes

#### Defined in

libs/jsx/dist/constants.d.ts:10

___

### dataAddress

• `Const` **dataAddress**: ``"data-address"``

attribute used to wire a dom element to a useMessenger exchange

#### Defined in

libs/jsx/dist/constants.d.ts:6

___

### dataTarget

• `Const` **dataTarget**: ``"data-target"``

attribute used to manipulate a dom element

#### Defined in

libs/jsx/dist/constants.d.ts:2

___

### dataTrigger

• `Const` **dataTrigger**: ``"data-trigger"``

attribute used to wire a dom element to the component event listener

#### Defined in

libs/jsx/dist/constants.d.ts:4

___

### primitives

• `Const` **primitives**: `Set`<`string`\>

#### Defined in

libs/jsx/dist/constants.d.ts:11

___

### validPrimitiveChildren

• `Const` **validPrimitiveChildren**: `Set`<`string`\>

#### Defined in

libs/jsx/dist/constants.d.ts:12

___

### voidTags

• `Const` **voidTags**: `Set`<`string`\>

void attributes

#### Defined in

libs/jsx/dist/constants.d.ts:8

## Functions

### Component

▸ **Component**(`«destructured»`): () => { `ATTRIBUTE_NODE`: ``2`` ; `CDATA_SECTION_NODE`: ``4`` ; `COMMENT_NODE`: ``8`` ; `DOCUMENT_FRAGMENT_NODE`: ``11`` ; `DOCUMENT_NODE`: ``9`` ; `DOCUMENT_POSITION_CONTAINED_BY`: ``16`` ; `DOCUMENT_POSITION_CONTAINS`: ``8`` ; `DOCUMENT_POSITION_DISCONNECTED`: ``1`` ; `DOCUMENT_POSITION_FOLLOWING`: ``4`` ; `DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC`: ``32`` ; `DOCUMENT_POSITION_PRECEDING`: ``2`` ; `DOCUMENT_TYPE_NODE`: ``10`` ; `ELEMENT_NODE`: ``1`` ; `ENTITY_NODE`: ``6`` ; `ENTITY_REFERENCE_NODE`: ``5`` ; `NOTATION_NODE`: ``12`` ; `PROCESSING_INSTRUCTION_NODE`: ``7`` ; `TEXT_NODE`: ``3`` ; `__#1@#disconnectMessenger?`: () => `void` ; `__#1@#root`: `ShadowRoot` ; `__#1@#shadowObserver?`: `MutationObserver` ; `__#1@#trigger`: [`Trigger`](plaited.index.md#trigger) ; `accessKey`: `string` ; `accessKeyLabel`: `string` ; `ariaAtomic`: `string` ; `ariaAutoComplete`: `string` ; `ariaBusy`: `string` ; `ariaChecked`: `string` ; `ariaColCount`: `string` ; `ariaColIndex`: `string` ; `ariaColSpan`: `string` ; `ariaCurrent`: `string` ; `ariaDisabled`: `string` ; `ariaExpanded`: `string` ; `ariaHasPopup`: `string` ; `ariaHidden`: `string` ; `ariaInvalid`: `string` ; `ariaKeyShortcuts`: `string` ; `ariaLabel`: `string` ; `ariaLevel`: `string` ; `ariaLive`: `string` ; `ariaModal`: `string` ; `ariaMultiLine`: `string` ; `ariaMultiSelectable`: `string` ; `ariaOrientation`: `string` ; `ariaPlaceholder`: `string` ; `ariaPosInSet`: `string` ; `ariaPressed`: `string` ; `ariaReadOnly`: `string` ; `ariaRequired`: `string` ; `ariaRoleDescription`: `string` ; `ariaRowCount`: `string` ; `ariaRowIndex`: `string` ; `ariaRowSpan`: `string` ; `ariaSelected`: `string` ; `ariaSetSize`: `string` ; `ariaSort`: `string` ; `ariaValueMax`: `string` ; `ariaValueMin`: `string` ; `ariaValueNow`: `string` ; `ariaValueText`: `string` ; `assignedSlot`: `HTMLSlotElement` ; `attributeStyleMap`: `StylePropertyMap` ; `attributes`: `NamedNodeMap` ; `autocapitalize`: `string` ; `autofocus`: `boolean` ; `baseURI`: `string` ; `childElementCount`: `number` ; `childNodes`: `NodeListOf`<`ChildNode`\> ; `children`: `HTMLCollection` ; `classList`: `DOMTokenList` ; `className`: `string` ; `clientHeight`: `number` ; `clientLeft`: `number` ; `clientTop`: `number` ; `clientWidth`: `number` ; `contentEditable`: `string` ; `dataset`: `DOMStringMap` ; `dir`: `string` ; `draggable`: `boolean` ; `enterKeyHint`: `string` ; `firstChild`: `ChildNode` ; `firstElementChild`: `Element` ; `hidden`: `boolean` ; `id`: `string` ; `inert`: `boolean` ; `innerHTML`: `string` ; `innerText`: `string` ; `inputMode`: `string` ; `internals_`: `ElementInternals` ; `isConnected`: `boolean` ; `isContentEditable`: `boolean` ; `lang`: `string` ; `lastChild`: `ChildNode` ; `lastElementChild`: `Element` ; `localName`: `string` ; `namespaceURI`: `string` ; `nextElementSibling`: `Element` ; `nextSibling`: `ChildNode` ; `nodeName`: `string` ; `nodeType`: `number` ; `nodeValue`: `string` ; `nonce?`: `string` ; `offsetHeight`: `number` ; `offsetLeft`: `number` ; `offsetParent`: `Element` ; `offsetTop`: `number` ; `offsetWidth`: `number` ; `onabort`: (`this`: `GlobalEventHandlers`, `ev`: `UIEvent`) => `any` ; `onanimationcancel`: (`this`: `GlobalEventHandlers`, `ev`: `AnimationEvent`) => `any` ; `onanimationend`: (`this`: `GlobalEventHandlers`, `ev`: `AnimationEvent`) => `any` ; `onanimationiteration`: (`this`: `GlobalEventHandlers`, `ev`: `AnimationEvent`) => `any` ; `onanimationstart`: (`this`: `GlobalEventHandlers`, `ev`: `AnimationEvent`) => `any` ; `onauxclick`: (`this`: `GlobalEventHandlers`, `ev`: `MouseEvent`) => `any` ; `onbeforeinput`: (`this`: `GlobalEventHandlers`, `ev`: `InputEvent`) => `any` ; `onblur`: (`this`: `GlobalEventHandlers`, `ev`: `FocusEvent`) => `any` ; `oncancel`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `oncanplay`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `oncanplaythrough`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `onchange`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `onclick`: (`this`: `GlobalEventHandlers`, `ev`: `MouseEvent`) => `any` ; `onclose`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `oncontextmenu`: (`this`: `GlobalEventHandlers`, `ev`: `MouseEvent`) => `any` ; `oncopy`: (`this`: `GlobalEventHandlers`, `ev`: `ClipboardEvent`) => `any` ; `oncuechange`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `oncut`: (`this`: `GlobalEventHandlers`, `ev`: `ClipboardEvent`) => `any` ; `ondblclick`: (`this`: `GlobalEventHandlers`, `ev`: `MouseEvent`) => `any` ; `ondrag`: (`this`: `GlobalEventHandlers`, `ev`: `DragEvent`) => `any` ; `ondragend`: (`this`: `GlobalEventHandlers`, `ev`: `DragEvent`) => `any` ; `ondragenter`: (`this`: `GlobalEventHandlers`, `ev`: `DragEvent`) => `any` ; `ondragleave`: (`this`: `GlobalEventHandlers`, `ev`: `DragEvent`) => `any` ; `ondragover`: (`this`: `GlobalEventHandlers`, `ev`: `DragEvent`) => `any` ; `ondragstart`: (`this`: `GlobalEventHandlers`, `ev`: `DragEvent`) => `any` ; `ondrop`: (`this`: `GlobalEventHandlers`, `ev`: `DragEvent`) => `any` ; `ondurationchange`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `onemptied`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `onended`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `onerror`: `OnErrorEventHandlerNonNull` ; `onfocus`: (`this`: `GlobalEventHandlers`, `ev`: `FocusEvent`) => `any` ; `onformdata`: (`this`: `GlobalEventHandlers`, `ev`: `FormDataEvent`) => `any` ; `onfullscreenchange`: (`this`: `Element`, `ev`: `Event`) => `any` ; `onfullscreenerror`: (`this`: `Element`, `ev`: `Event`) => `any` ; `ongotpointercapture`: (`this`: `GlobalEventHandlers`, `ev`: `PointerEvent`) => `any` ; `oninput`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `oninvalid`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `onkeydown`: (`this`: `GlobalEventHandlers`, `ev`: `KeyboardEvent`) => `any` ; `onkeypress`: (`this`: `GlobalEventHandlers`, `ev`: `KeyboardEvent`) => `any` ; `onkeyup`: (`this`: `GlobalEventHandlers`, `ev`: `KeyboardEvent`) => `any` ; `onload`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `onloadeddata`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `onloadedmetadata`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `onloadstart`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `onlostpointercapture`: (`this`: `GlobalEventHandlers`, `ev`: `PointerEvent`) => `any` ; `onmousedown`: (`this`: `GlobalEventHandlers`, `ev`: `MouseEvent`) => `any` ; `onmouseenter`: (`this`: `GlobalEventHandlers`, `ev`: `MouseEvent`) => `any` ; `onmouseleave`: (`this`: `GlobalEventHandlers`, `ev`: `MouseEvent`) => `any` ; `onmousemove`: (`this`: `GlobalEventHandlers`, `ev`: `MouseEvent`) => `any` ; `onmouseout`: (`this`: `GlobalEventHandlers`, `ev`: `MouseEvent`) => `any` ; `onmouseover`: (`this`: `GlobalEventHandlers`, `ev`: `MouseEvent`) => `any` ; `onmouseup`: (`this`: `GlobalEventHandlers`, `ev`: `MouseEvent`) => `any` ; `onpaste`: (`this`: `GlobalEventHandlers`, `ev`: `ClipboardEvent`) => `any` ; `onpause`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `onplay`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `onplaying`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `onpointercancel`: (`this`: `GlobalEventHandlers`, `ev`: `PointerEvent`) => `any` ; `onpointerdown`: (`this`: `GlobalEventHandlers`, `ev`: `PointerEvent`) => `any` ; `onpointerenter`: (`this`: `GlobalEventHandlers`, `ev`: `PointerEvent`) => `any` ; `onpointerleave`: (`this`: `GlobalEventHandlers`, `ev`: `PointerEvent`) => `any` ; `onpointermove`: (`this`: `GlobalEventHandlers`, `ev`: `PointerEvent`) => `any` ; `onpointerout`: (`this`: `GlobalEventHandlers`, `ev`: `PointerEvent`) => `any` ; `onpointerover`: (`this`: `GlobalEventHandlers`, `ev`: `PointerEvent`) => `any` ; `onpointerup`: (`this`: `GlobalEventHandlers`, `ev`: `PointerEvent`) => `any` ; `onprogress`: (`this`: `GlobalEventHandlers`, `ev`: `ProgressEvent`<`EventTarget`\>) => `any` ; `onratechange`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `onreset`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `onresize`: (`this`: `GlobalEventHandlers`, `ev`: `UIEvent`) => `any` ; `onscroll`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `onscrollend`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `onsecuritypolicyviolation`: (`this`: `GlobalEventHandlers`, `ev`: `SecurityPolicyViolationEvent`) => `any` ; `onseeked`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `onseeking`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `onselect`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `onselectionchange`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `onselectstart`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `onslotchange`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `onstalled`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `onsubmit`: (`this`: `GlobalEventHandlers`, `ev`: `SubmitEvent`) => `any` ; `onsuspend`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `ontimeupdate`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `ontoggle`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `ontouchcancel?`: (`this`: `GlobalEventHandlers`, `ev`: `TouchEvent`) => `any` ; `ontouchend?`: (`this`: `GlobalEventHandlers`, `ev`: `TouchEvent`) => `any` ; `ontouchmove?`: (`this`: `GlobalEventHandlers`, `ev`: `TouchEvent`) => `any` ; `ontouchstart?`: (`this`: `GlobalEventHandlers`, `ev`: `TouchEvent`) => `any` ; `ontransitioncancel`: (`this`: `GlobalEventHandlers`, `ev`: `TransitionEvent`) => `any` ; `ontransitionend`: (`this`: `GlobalEventHandlers`, `ev`: `TransitionEvent`) => `any` ; `ontransitionrun`: (`this`: `GlobalEventHandlers`, `ev`: `TransitionEvent`) => `any` ; `ontransitionstart`: (`this`: `GlobalEventHandlers`, `ev`: `TransitionEvent`) => `any` ; `onvolumechange`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `onwaiting`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `onwebkitanimationend`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `onwebkitanimationiteration`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `onwebkitanimationstart`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `onwebkittransitionend`: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` ; `onwheel`: (`this`: `GlobalEventHandlers`, `ev`: `WheelEvent`) => `any` ; `outerHTML`: `string` ; `outerText`: `string` ; `ownerDocument`: `Document` ; `parentElement`: `HTMLElement` ; `parentNode`: `ParentNode` ; `part`: `DOMTokenList` ; `popover`: `string` ; `prefix`: `string` ; `previousElementSibling`: `Element` ; `previousSibling`: `ChildNode` ; `role`: `string` ; `scrollHeight`: `number` ; `scrollLeft`: `number` ; `scrollTop`: `number` ; `scrollWidth`: `number` ; `shadowRoot`: `ShadowRoot` ; `slot`: `string` ; `spellcheck`: `boolean` ; `style`: `CSSStyleDeclaration` ; `tabIndex`: `number` ; `tagName`: `string` ; `textContent`: `string` ; `title`: `string` ; `translate`: `boolean` ; `$`: <T_1\>(`target`: `string`, `opts?`: { `all?`: ``false`` ; `mod?`: [`SelectorMod`](plaited.index.md#selectormod)  }) => `SugaredElement`<`T_1`\><T_2\>(`target`: `string`, `opts?`: { `all`: ``true`` ; `mod?`: [`SelectorMod`](plaited.index.md#selectormod)  }) => `SugaredElement`<`T_2`\>[] ; `__#1@#bProgram`: () => { `addThreads`: (`threads`: `Record`<`string`, [`RulesFunc`](plaited.index.md#rulesfunc)<`unknown`\>\>) => `void` ; `feedback`: [`Feedback`](plaited.index.md#feedback) ; `loop`: (`rules`: [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\>[], `condition?`: () => `boolean`) => [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\> ; `sync`: <T\>(`set`: [`RuleSet`](plaited.index.md#ruleset)<`T`\>) => [`RulesFunc`](plaited.index.md#rulesfunc)<`T`\> ; `thread`: (...`rules`: [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\>[]) => [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\> ; `trigger`: [`Trigger`](plaited.index.md#trigger)  } ; `__#1@#createDelegatedListener`: (`el`: `HTMLElement` \| `SVGElement`) => `void` ; `__#1@#createShadowObserver`: () => `MutationObserver` ; `__#1@#delegateListeners`: (`nodes`: `Node`[]) => `void` ; `__#1@#delegateObservedTriggers`: () => `void` ; `__#1@#getObservedTriggerType`: (`el`: `HTMLElement` \| `SVGElement`, `event`: `Event`) => `string` ; `addEventListener`: <K\>(`type`: `K`, `listener`: (`this`: `HTMLElement`, `ev`: `HTMLElementEventMap`[`K`]) => `any`, `options?`: `boolean` \| `AddEventListenerOptions`) => `void`(`type`: `string`, `listener`: `EventListenerOrEventListenerObject`, `options?`: `boolean` \| `AddEventListenerOptions`) => `void` ; `after`: (...`nodes`: (`string` \| `Node`)[]) => `void` ; `animate`: (`keyframes`: `PropertyIndexedKeyframes` \| `Keyframe`[], `options?`: `number` \| `KeyframeAnimationOptions`) => `Animation` ; `append`: (...`nodes`: (`string` \| `Node`)[]) => `void` ; `appendChild`: <T_3\>(`node`: `T_3`) => `T_3` ; `attachInternals`: () => `ElementInternals` ; `attachShadow`: (`init`: `ShadowRootInit`) => `ShadowRoot` ; `before`: (...`nodes`: (`string` \| `Node`)[]) => `void` ; `blur`: () => `void` ; `checkVisibility`: (`options?`: `CheckVisibilityOptions`) => `boolean` ; `click`: () => `void` ; `cloneNode`: (`deep?`: `boolean`) => `Node` ; `closest`: <K_2\>(`selector`: `K_2`) => `HTMLElementTagNameMap`[`K_2`]<K_3\>(`selector`: `K_3`) => `SVGElementTagNameMap`[`K_3`]<K_4\>(`selector`: `K_4`) => `MathMLElementTagNameMap`[`K_4`]<E\>(`selectors`: `string`) => `E` ; `compareDocumentPosition`: (`other`: `Node`) => `number` ; `computedStyleMap`: () => `StylePropertyMapReadOnly` ; `connectedCallback`: () => `void` ; `contains`: (`other`: `Node`) => `boolean` ; `disconnectedCallback`: () => `void` ; `dispatchEvent`: (`event`: `Event`) => `boolean` ; `focus`: (`options?`: `FocusOptions`) => `void` ; `getAnimations`: (`options?`: `GetAnimationsOptions`) => `Animation`[] ; `getAttribute`: (`qualifiedName`: `string`) => `string` ; `getAttributeNS`: (`namespace`: `string`, `localName`: `string`) => `string` ; `getAttributeNames`: () => `string`[] ; `getAttributeNode`: (`qualifiedName`: `string`) => `Attr` ; `getAttributeNodeNS`: (`namespace`: `string`, `localName`: `string`) => `Attr` ; `getBoundingClientRect`: () => `DOMRect` ; `getClientRects`: () => `DOMRectList` ; `getElementsByClassName`: (`classNames`: `string`) => `HTMLCollectionOf`<`Element`\> ; `getElementsByTagName`: <K_5\>(`qualifiedName`: `K_5`) => `HTMLCollectionOf`<`HTMLElementTagNameMap`[`K_5`]\><K_6\>(`qualifiedName`: `K_6`) => `HTMLCollectionOf`<`SVGElementTagNameMap`[`K_6`]\><K_7\>(`qualifiedName`: `K_7`) => `HTMLCollectionOf`<`MathMLElementTagNameMap`[`K_7`]\><K_8\>(`qualifiedName`: `K_8`) => `HTMLCollectionOf`<`HTMLElementDeprecatedTagNameMap`[`K_8`]\>(`qualifiedName`: `string`) => `HTMLCollectionOf`<`Element`\> ; `getElementsByTagNameNS`: (`namespaceURI`: ``"http://www.w3.org/1999/xhtml"``, `localName`: `string`) => `HTMLCollectionOf`<`HTMLElement`\>(`namespaceURI`: ``"http://www.w3.org/2000/svg"``, `localName`: `string`) => `HTMLCollectionOf`<`SVGElement`\>(`namespaceURI`: ``"http://www.w3.org/1998/Math/MathML"``, `localName`: `string`) => `HTMLCollectionOf`<`MathMLElement`\>(`namespace`: `string`, `localName`: `string`) => `HTMLCollectionOf`<`Element`\> ; `getRootNode`: (`options?`: `GetRootNodeOptions`) => `Node` ; `hasAttribute`: (`qualifiedName`: `string`) => `boolean` ; `hasAttributeNS`: (`namespace`: `string`, `localName`: `string`) => `boolean` ; `hasAttributes`: () => `boolean` ; `hasChildNodes`: () => `boolean` ; `hasPointerCapture`: (`pointerId`: `number`) => `boolean` ; `hidePopover`: () => `void` ; `insertAdjacentElement`: (`where`: `InsertPosition`, `element`: `Element`) => `Element` ; `insertAdjacentHTML`: (`position`: `InsertPosition`, `text`: `string`) => `void` ; `insertAdjacentText`: (`where`: `InsertPosition`, `data`: `string`) => `void` ; `insertBefore`: <T_4\>(`node`: `T_4`, `child`: `Node`) => `T_4` ; `isDefaultNamespace`: (`namespace`: `string`) => `boolean` ; `isEqualNode`: (`otherNode`: `Node`) => `boolean` ; `isSameNode`: (`otherNode`: `Node`) => `boolean` ; `lookupNamespaceURI`: (`prefix`: `string`) => `string` ; `lookupPrefix`: (`namespace`: `string`) => `string` ; `matches`: (`selectors`: `string`) => `boolean` ; `normalize`: () => `void` ; `plait?`: (`props`: [`PlaitProps`](plaited.index.md#plaitprops)) => `void` \| `Promise`<`void`\> ; `prepend`: (...`nodes`: (`string` \| `Node`)[]) => `void` ; `querySelector`: <K_9\>(`selectors`: `K_9`) => `HTMLElementTagNameMap`[`K_9`]<K_10\>(`selectors`: `K_10`) => `SVGElementTagNameMap`[`K_10`]<K_11\>(`selectors`: `K_11`) => `MathMLElementTagNameMap`[`K_11`]<K_12\>(`selectors`: `K_12`) => `HTMLElementDeprecatedTagNameMap`[`K_12`]<E_1\>(`selectors`: `string`) => `E_1` ; `querySelectorAll`: <K_13\>(`selectors`: `K_13`) => `NodeListOf`<`HTMLElementTagNameMap`[`K_13`]\><K_14\>(`selectors`: `K_14`) => `NodeListOf`<`SVGElementTagNameMap`[`K_14`]\><K_15\>(`selectors`: `K_15`) => `NodeListOf`<`MathMLElementTagNameMap`[`K_15`]\><K_16\>(`selectors`: `K_16`) => `NodeListOf`<`HTMLElementDeprecatedTagNameMap`[`K_16`]\><E_2\>(`selectors`: `string`) => `NodeListOf`<`E_2`\> ; `releasePointerCapture`: (`pointerId`: `number`) => `void` ; `remove`: () => `void` ; `removeAttribute`: (`qualifiedName`: `string`) => `void` ; `removeAttributeNS`: (`namespace`: `string`, `localName`: `string`) => `void` ; `removeAttributeNode`: (`attr`: `Attr`) => `Attr` ; `removeChild`: <T_5\>(`child`: `T_5`) => `T_5` ; `removeEventListener`: <K_1\>(`type`: `K_1`, `listener`: (`this`: `HTMLElement`, `ev`: `HTMLElementEventMap`[`K_1`]) => `any`, `options?`: `boolean` \| `EventListenerOptions`) => `void`(`type`: `string`, `listener`: `EventListenerOrEventListenerObject`, `options?`: `boolean` \| `EventListenerOptions`) => `void` ; `replaceChild`: <T_6\>(`node`: `Node`, `child`: `T_6`) => `T_6` ; `replaceChildren`: (...`nodes`: (`string` \| `Node`)[]) => `void` ; `replaceWith`: (...`nodes`: (`string` \| `Node`)[]) => `void` ; `requestFullscreen`: (`options?`: `FullscreenOptions`) => `Promise`<`void`\> ; `requestPointerLock`: () => `void` ; `scroll`: (`options?`: `ScrollToOptions`) => `void`(`x`: `number`, `y`: `number`) => `void` ; `scrollBy`: (`options?`: `ScrollToOptions`) => `void`(`x`: `number`, `y`: `number`) => `void` ; `scrollIntoView`: (`arg?`: `boolean` \| `ScrollIntoViewOptions`) => `void` ; `scrollTo`: (`options?`: `ScrollToOptions`) => `void`(`x`: `number`, `y`: `number`) => `void` ; `setAttribute`: (`qualifiedName`: `string`, `value`: `string`) => `void` ; `setAttributeNS`: (`namespace`: `string`, `qualifiedName`: `string`, `value`: `string`) => `void` ; `setAttributeNode`: (`attr`: `Attr`) => `Attr` ; `setAttributeNodeNS`: (`attr`: `Attr`) => `Attr` ; `setPointerCapture`: (`pointerId`: `number`) => `void` ; `showPopover`: () => `void` ; `toggleAttribute`: (`qualifiedName`: `string`, `force?`: `boolean`) => `boolean` ; `togglePopover`: (`force?`: `boolean`) => `void` ; `webkitMatchesSelector`: (`selectors`: `string`) => `boolean`  }

#### Parameters

| Name | Type |
| :------ | :------ |
| `«destructured»` | [`ComponentArgs`](plaited.index.md#componentargs) |

#### Returns

`fn`

• **new Component**(): `Object`

##### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `ATTRIBUTE_NODE` | ``2`` |
| `CDATA_SECTION_NODE` | ``4`` |
| `COMMENT_NODE` | ``8`` |
| `DOCUMENT_FRAGMENT_NODE` | ``11`` |
| `DOCUMENT_NODE` | ``9`` |
| `DOCUMENT_POSITION_CONTAINED_BY` | ``16`` |
| `DOCUMENT_POSITION_CONTAINS` | ``8`` |
| `DOCUMENT_POSITION_DISCONNECTED` | ``1`` |
| `DOCUMENT_POSITION_FOLLOWING` | ``4`` |
| `DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC` | ``32`` |
| `DOCUMENT_POSITION_PRECEDING` | ``2`` |
| `DOCUMENT_TYPE_NODE` | ``10`` |
| `ELEMENT_NODE` | ``1`` |
| `ENTITY_NODE` | ``6`` |
| `ENTITY_REFERENCE_NODE` | ``5`` |
| `NOTATION_NODE` | ``12`` |
| `PROCESSING_INSTRUCTION_NODE` | ``7`` |
| `TEXT_NODE` | ``3`` |
| `__#1@#disconnectMessenger?` | () => `void` |
| `__#1@#root` | `ShadowRoot` |
| `__#1@#shadowObserver?` | `MutationObserver` |
| `__#1@#trigger` | [`Trigger`](plaited.index.md#trigger) |
| `accessKey` | `string` |
| `accessKeyLabel` | `string` |
| `ariaAtomic` | `string` |
| `ariaAutoComplete` | `string` |
| `ariaBusy` | `string` |
| `ariaChecked` | `string` |
| `ariaColCount` | `string` |
| `ariaColIndex` | `string` |
| `ariaColSpan` | `string` |
| `ariaCurrent` | `string` |
| `ariaDisabled` | `string` |
| `ariaExpanded` | `string` |
| `ariaHasPopup` | `string` |
| `ariaHidden` | `string` |
| `ariaInvalid` | `string` |
| `ariaKeyShortcuts` | `string` |
| `ariaLabel` | `string` |
| `ariaLevel` | `string` |
| `ariaLive` | `string` |
| `ariaModal` | `string` |
| `ariaMultiLine` | `string` |
| `ariaMultiSelectable` | `string` |
| `ariaOrientation` | `string` |
| `ariaPlaceholder` | `string` |
| `ariaPosInSet` | `string` |
| `ariaPressed` | `string` |
| `ariaReadOnly` | `string` |
| `ariaRequired` | `string` |
| `ariaRoleDescription` | `string` |
| `ariaRowCount` | `string` |
| `ariaRowIndex` | `string` |
| `ariaRowSpan` | `string` |
| `ariaSelected` | `string` |
| `ariaSetSize` | `string` |
| `ariaSort` | `string` |
| `ariaValueMax` | `string` |
| `ariaValueMin` | `string` |
| `ariaValueNow` | `string` |
| `ariaValueText` | `string` |
| `assignedSlot` | `HTMLSlotElement` |
| `attributeStyleMap` | `StylePropertyMap` |
| `attributes` | `NamedNodeMap` |
| `autocapitalize` | `string` |
| `autofocus` | `boolean` |
| `baseURI` | `string` |
| `childElementCount` | `number` |
| `childNodes` | `NodeListOf`<`ChildNode`\> |
| `children` | `HTMLCollection` |
| `classList` | `DOMTokenList` |
| `className` | `string` |
| `clientHeight` | `number` |
| `clientLeft` | `number` |
| `clientTop` | `number` |
| `clientWidth` | `number` |
| `contentEditable` | `string` |
| `dataset` | `DOMStringMap` |
| `dir` | `string` |
| `draggable` | `boolean` |
| `enterKeyHint` | `string` |
| `firstChild` | `ChildNode` |
| `firstElementChild` | `Element` |
| `hidden` | `boolean` |
| `id` | `string` |
| `inert` | `boolean` |
| `innerHTML` | `string` |
| `innerText` | `string` |
| `inputMode` | `string` |
| `internals_` | `ElementInternals` |
| `isConnected` | `boolean` |
| `isContentEditable` | `boolean` |
| `lang` | `string` |
| `lastChild` | `ChildNode` |
| `lastElementChild` | `Element` |
| `localName` | `string` |
| `namespaceURI` | `string` |
| `nextElementSibling` | `Element` |
| `nextSibling` | `ChildNode` |
| `nodeName` | `string` |
| `nodeType` | `number` |
| `nodeValue` | `string` |
| `nonce?` | `string` |
| `offsetHeight` | `number` |
| `offsetLeft` | `number` |
| `offsetParent` | `Element` |
| `offsetTop` | `number` |
| `offsetWidth` | `number` |
| `onabort` | (`this`: `GlobalEventHandlers`, `ev`: `UIEvent`) => `any` |
| `onanimationcancel` | (`this`: `GlobalEventHandlers`, `ev`: `AnimationEvent`) => `any` |
| `onanimationend` | (`this`: `GlobalEventHandlers`, `ev`: `AnimationEvent`) => `any` |
| `onanimationiteration` | (`this`: `GlobalEventHandlers`, `ev`: `AnimationEvent`) => `any` |
| `onanimationstart` | (`this`: `GlobalEventHandlers`, `ev`: `AnimationEvent`) => `any` |
| `onauxclick` | (`this`: `GlobalEventHandlers`, `ev`: `MouseEvent`) => `any` |
| `onbeforeinput` | (`this`: `GlobalEventHandlers`, `ev`: `InputEvent`) => `any` |
| `onblur` | (`this`: `GlobalEventHandlers`, `ev`: `FocusEvent`) => `any` |
| `oncancel` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `oncanplay` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `oncanplaythrough` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `onchange` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `onclick` | (`this`: `GlobalEventHandlers`, `ev`: `MouseEvent`) => `any` |
| `onclose` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `oncontextmenu` | (`this`: `GlobalEventHandlers`, `ev`: `MouseEvent`) => `any` |
| `oncopy` | (`this`: `GlobalEventHandlers`, `ev`: `ClipboardEvent`) => `any` |
| `oncuechange` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `oncut` | (`this`: `GlobalEventHandlers`, `ev`: `ClipboardEvent`) => `any` |
| `ondblclick` | (`this`: `GlobalEventHandlers`, `ev`: `MouseEvent`) => `any` |
| `ondrag` | (`this`: `GlobalEventHandlers`, `ev`: `DragEvent`) => `any` |
| `ondragend` | (`this`: `GlobalEventHandlers`, `ev`: `DragEvent`) => `any` |
| `ondragenter` | (`this`: `GlobalEventHandlers`, `ev`: `DragEvent`) => `any` |
| `ondragleave` | (`this`: `GlobalEventHandlers`, `ev`: `DragEvent`) => `any` |
| `ondragover` | (`this`: `GlobalEventHandlers`, `ev`: `DragEvent`) => `any` |
| `ondragstart` | (`this`: `GlobalEventHandlers`, `ev`: `DragEvent`) => `any` |
| `ondrop` | (`this`: `GlobalEventHandlers`, `ev`: `DragEvent`) => `any` |
| `ondurationchange` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `onemptied` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `onended` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `onerror` | `OnErrorEventHandlerNonNull` |
| `onfocus` | (`this`: `GlobalEventHandlers`, `ev`: `FocusEvent`) => `any` |
| `onformdata` | (`this`: `GlobalEventHandlers`, `ev`: `FormDataEvent`) => `any` |
| `onfullscreenchange` | (`this`: `Element`, `ev`: `Event`) => `any` |
| `onfullscreenerror` | (`this`: `Element`, `ev`: `Event`) => `any` |
| `ongotpointercapture` | (`this`: `GlobalEventHandlers`, `ev`: `PointerEvent`) => `any` |
| `oninput` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `oninvalid` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `onkeydown` | (`this`: `GlobalEventHandlers`, `ev`: `KeyboardEvent`) => `any` |
| `onkeypress` | (`this`: `GlobalEventHandlers`, `ev`: `KeyboardEvent`) => `any` |
| `onkeyup` | (`this`: `GlobalEventHandlers`, `ev`: `KeyboardEvent`) => `any` |
| `onload` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `onloadeddata` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `onloadedmetadata` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `onloadstart` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `onlostpointercapture` | (`this`: `GlobalEventHandlers`, `ev`: `PointerEvent`) => `any` |
| `onmousedown` | (`this`: `GlobalEventHandlers`, `ev`: `MouseEvent`) => `any` |
| `onmouseenter` | (`this`: `GlobalEventHandlers`, `ev`: `MouseEvent`) => `any` |
| `onmouseleave` | (`this`: `GlobalEventHandlers`, `ev`: `MouseEvent`) => `any` |
| `onmousemove` | (`this`: `GlobalEventHandlers`, `ev`: `MouseEvent`) => `any` |
| `onmouseout` | (`this`: `GlobalEventHandlers`, `ev`: `MouseEvent`) => `any` |
| `onmouseover` | (`this`: `GlobalEventHandlers`, `ev`: `MouseEvent`) => `any` |
| `onmouseup` | (`this`: `GlobalEventHandlers`, `ev`: `MouseEvent`) => `any` |
| `onpaste` | (`this`: `GlobalEventHandlers`, `ev`: `ClipboardEvent`) => `any` |
| `onpause` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `onplay` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `onplaying` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `onpointercancel` | (`this`: `GlobalEventHandlers`, `ev`: `PointerEvent`) => `any` |
| `onpointerdown` | (`this`: `GlobalEventHandlers`, `ev`: `PointerEvent`) => `any` |
| `onpointerenter` | (`this`: `GlobalEventHandlers`, `ev`: `PointerEvent`) => `any` |
| `onpointerleave` | (`this`: `GlobalEventHandlers`, `ev`: `PointerEvent`) => `any` |
| `onpointermove` | (`this`: `GlobalEventHandlers`, `ev`: `PointerEvent`) => `any` |
| `onpointerout` | (`this`: `GlobalEventHandlers`, `ev`: `PointerEvent`) => `any` |
| `onpointerover` | (`this`: `GlobalEventHandlers`, `ev`: `PointerEvent`) => `any` |
| `onpointerup` | (`this`: `GlobalEventHandlers`, `ev`: `PointerEvent`) => `any` |
| `onprogress` | (`this`: `GlobalEventHandlers`, `ev`: `ProgressEvent`<`EventTarget`\>) => `any` |
| `onratechange` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `onreset` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `onresize` | (`this`: `GlobalEventHandlers`, `ev`: `UIEvent`) => `any` |
| `onscroll` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `onscrollend` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `onsecuritypolicyviolation` | (`this`: `GlobalEventHandlers`, `ev`: `SecurityPolicyViolationEvent`) => `any` |
| `onseeked` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `onseeking` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `onselect` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `onselectionchange` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `onselectstart` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `onslotchange` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `onstalled` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `onsubmit` | (`this`: `GlobalEventHandlers`, `ev`: `SubmitEvent`) => `any` |
| `onsuspend` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `ontimeupdate` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `ontoggle` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `ontouchcancel?` | (`this`: `GlobalEventHandlers`, `ev`: `TouchEvent`) => `any` |
| `ontouchend?` | (`this`: `GlobalEventHandlers`, `ev`: `TouchEvent`) => `any` |
| `ontouchmove?` | (`this`: `GlobalEventHandlers`, `ev`: `TouchEvent`) => `any` |
| `ontouchstart?` | (`this`: `GlobalEventHandlers`, `ev`: `TouchEvent`) => `any` |
| `ontransitioncancel` | (`this`: `GlobalEventHandlers`, `ev`: `TransitionEvent`) => `any` |
| `ontransitionend` | (`this`: `GlobalEventHandlers`, `ev`: `TransitionEvent`) => `any` |
| `ontransitionrun` | (`this`: `GlobalEventHandlers`, `ev`: `TransitionEvent`) => `any` |
| `ontransitionstart` | (`this`: `GlobalEventHandlers`, `ev`: `TransitionEvent`) => `any` |
| `onvolumechange` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `onwaiting` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `onwebkitanimationend` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `onwebkitanimationiteration` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `onwebkitanimationstart` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `onwebkittransitionend` | (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any` |
| `onwheel` | (`this`: `GlobalEventHandlers`, `ev`: `WheelEvent`) => `any` |
| `outerHTML` | `string` |
| `outerText` | `string` |
| `ownerDocument` | `Document` |
| `parentElement` | `HTMLElement` |
| `parentNode` | `ParentNode` |
| `part` | `DOMTokenList` |
| `popover` | `string` |
| `prefix` | `string` |
| `previousElementSibling` | `Element` |
| `previousSibling` | `ChildNode` |
| `role` | `string` |
| `scrollHeight` | `number` |
| `scrollLeft` | `number` |
| `scrollTop` | `number` |
| `scrollWidth` | `number` |
| `shadowRoot` | `ShadowRoot` |
| `slot` | `string` |
| `spellcheck` | `boolean` |
| `style` | `CSSStyleDeclaration` |
| `tabIndex` | `number` |
| `tagName` | `string` |
| `textContent` | `string` |
| `title` | `string` |
| `translate` | `boolean` |
| `$` | <T_1\>(`target`: `string`, `opts?`: { `all?`: ``false`` ; `mod?`: [`SelectorMod`](plaited.index.md#selectormod)  }) => `SugaredElement`<`T_1`\><T_2\>(`target`: `string`, `opts?`: { `all`: ``true`` ; `mod?`: [`SelectorMod`](plaited.index.md#selectormod)  }) => `SugaredElement`<`T_2`\>[] |
| `__#1@#bProgram` | () => { `addThreads`: (`threads`: `Record`<`string`, [`RulesFunc`](plaited.index.md#rulesfunc)<`unknown`\>\>) => `void` ; `feedback`: [`Feedback`](plaited.index.md#feedback) ; `loop`: (`rules`: [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\>[], `condition?`: () => `boolean`) => [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\> ; `sync`: <T\>(`set`: [`RuleSet`](plaited.index.md#ruleset)<`T`\>) => [`RulesFunc`](plaited.index.md#rulesfunc)<`T`\> ; `thread`: (...`rules`: [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\>[]) => [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\> ; `trigger`: [`Trigger`](plaited.index.md#trigger)  } |
| `__#1@#createDelegatedListener` | (`el`: `HTMLElement` \| `SVGElement`) => `void` |
| `__#1@#createShadowObserver` | () => `MutationObserver` |
| `__#1@#delegateListeners` | (`nodes`: `Node`[]) => `void` |
| `__#1@#delegateObservedTriggers` | () => `void` |
| `__#1@#getObservedTriggerType` | (`el`: `HTMLElement` \| `SVGElement`, `event`: `Event`) => `string` |
| `addEventListener` | <K\>(`type`: `K`, `listener`: (`this`: `HTMLElement`, `ev`: `HTMLElementEventMap`[`K`]) => `any`, `options?`: `boolean` \| `AddEventListenerOptions`) => `void`(`type`: `string`, `listener`: `EventListenerOrEventListenerObject`, `options?`: `boolean` \| `AddEventListenerOptions`) => `void` |
| `after` | (...`nodes`: (`string` \| `Node`)[]) => `void` |
| `animate` | (`keyframes`: `PropertyIndexedKeyframes` \| `Keyframe`[], `options?`: `number` \| `KeyframeAnimationOptions`) => `Animation` |
| `append` | (...`nodes`: (`string` \| `Node`)[]) => `void` |
| `appendChild` | <T_3\>(`node`: `T_3`) => `T_3` |
| `attachInternals` | () => `ElementInternals` |
| `attachShadow` | (`init`: `ShadowRootInit`) => `ShadowRoot` |
| `before` | (...`nodes`: (`string` \| `Node`)[]) => `void` |
| `blur` | () => `void` |
| `checkVisibility` | (`options?`: `CheckVisibilityOptions`) => `boolean` |
| `click` | () => `void` |
| `cloneNode` | (`deep?`: `boolean`) => `Node` |
| `closest` | <K_2\>(`selector`: `K_2`) => `HTMLElementTagNameMap`[`K_2`]<K_3\>(`selector`: `K_3`) => `SVGElementTagNameMap`[`K_3`]<K_4\>(`selector`: `K_4`) => `MathMLElementTagNameMap`[`K_4`]<E\>(`selectors`: `string`) => `E` |
| `compareDocumentPosition` | (`other`: `Node`) => `number` |
| `computedStyleMap` | () => `StylePropertyMapReadOnly` |
| `connectedCallback` | () => `void` |
| `contains` | (`other`: `Node`) => `boolean` |
| `disconnectedCallback` | () => `void` |
| `dispatchEvent` | (`event`: `Event`) => `boolean` |
| `focus` | (`options?`: `FocusOptions`) => `void` |
| `getAnimations` | (`options?`: `GetAnimationsOptions`) => `Animation`[] |
| `getAttribute` | (`qualifiedName`: `string`) => `string` |
| `getAttributeNS` | (`namespace`: `string`, `localName`: `string`) => `string` |
| `getAttributeNames` | () => `string`[] |
| `getAttributeNode` | (`qualifiedName`: `string`) => `Attr` |
| `getAttributeNodeNS` | (`namespace`: `string`, `localName`: `string`) => `Attr` |
| `getBoundingClientRect` | () => `DOMRect` |
| `getClientRects` | () => `DOMRectList` |
| `getElementsByClassName` | (`classNames`: `string`) => `HTMLCollectionOf`<`Element`\> |
| `getElementsByTagName` | <K_5\>(`qualifiedName`: `K_5`) => `HTMLCollectionOf`<`HTMLElementTagNameMap`[`K_5`]\><K_6\>(`qualifiedName`: `K_6`) => `HTMLCollectionOf`<`SVGElementTagNameMap`[`K_6`]\><K_7\>(`qualifiedName`: `K_7`) => `HTMLCollectionOf`<`MathMLElementTagNameMap`[`K_7`]\><K_8\>(`qualifiedName`: `K_8`) => `HTMLCollectionOf`<`HTMLElementDeprecatedTagNameMap`[`K_8`]\>(`qualifiedName`: `string`) => `HTMLCollectionOf`<`Element`\> |
| `getElementsByTagNameNS` | (`namespaceURI`: ``"http://www.w3.org/1999/xhtml"``, `localName`: `string`) => `HTMLCollectionOf`<`HTMLElement`\>(`namespaceURI`: ``"http://www.w3.org/2000/svg"``, `localName`: `string`) => `HTMLCollectionOf`<`SVGElement`\>(`namespaceURI`: ``"http://www.w3.org/1998/Math/MathML"``, `localName`: `string`) => `HTMLCollectionOf`<`MathMLElement`\>(`namespace`: `string`, `localName`: `string`) => `HTMLCollectionOf`<`Element`\> |
| `getRootNode` | (`options?`: `GetRootNodeOptions`) => `Node` |
| `hasAttribute` | (`qualifiedName`: `string`) => `boolean` |
| `hasAttributeNS` | (`namespace`: `string`, `localName`: `string`) => `boolean` |
| `hasAttributes` | () => `boolean` |
| `hasChildNodes` | () => `boolean` |
| `hasPointerCapture` | (`pointerId`: `number`) => `boolean` |
| `hidePopover` | () => `void` |
| `insertAdjacentElement` | (`where`: `InsertPosition`, `element`: `Element`) => `Element` |
| `insertAdjacentHTML` | (`position`: `InsertPosition`, `text`: `string`) => `void` |
| `insertAdjacentText` | (`where`: `InsertPosition`, `data`: `string`) => `void` |
| `insertBefore` | <T_4\>(`node`: `T_4`, `child`: `Node`) => `T_4` |
| `isDefaultNamespace` | (`namespace`: `string`) => `boolean` |
| `isEqualNode` | (`otherNode`: `Node`) => `boolean` |
| `isSameNode` | (`otherNode`: `Node`) => `boolean` |
| `lookupNamespaceURI` | (`prefix`: `string`) => `string` |
| `lookupPrefix` | (`namespace`: `string`) => `string` |
| `matches` | (`selectors`: `string`) => `boolean` |
| `normalize` | () => `void` |
| `plait?` | (`props`: [`PlaitProps`](plaited.index.md#plaitprops)) => `void` \| `Promise`<`void`\> |
| `prepend` | (...`nodes`: (`string` \| `Node`)[]) => `void` |
| `querySelector` | <K_9\>(`selectors`: `K_9`) => `HTMLElementTagNameMap`[`K_9`]<K_10\>(`selectors`: `K_10`) => `SVGElementTagNameMap`[`K_10`]<K_11\>(`selectors`: `K_11`) => `MathMLElementTagNameMap`[`K_11`]<K_12\>(`selectors`: `K_12`) => `HTMLElementDeprecatedTagNameMap`[`K_12`]<E_1\>(`selectors`: `string`) => `E_1` |
| `querySelectorAll` | <K_13\>(`selectors`: `K_13`) => `NodeListOf`<`HTMLElementTagNameMap`[`K_13`]\><K_14\>(`selectors`: `K_14`) => `NodeListOf`<`SVGElementTagNameMap`[`K_14`]\><K_15\>(`selectors`: `K_15`) => `NodeListOf`<`MathMLElementTagNameMap`[`K_15`]\><K_16\>(`selectors`: `K_16`) => `NodeListOf`<`HTMLElementDeprecatedTagNameMap`[`K_16`]\><E_2\>(`selectors`: `string`) => `NodeListOf`<`E_2`\> |
| `releasePointerCapture` | (`pointerId`: `number`) => `void` |
| `remove` | () => `void` |
| `removeAttribute` | (`qualifiedName`: `string`) => `void` |
| `removeAttributeNS` | (`namespace`: `string`, `localName`: `string`) => `void` |
| `removeAttributeNode` | (`attr`: `Attr`) => `Attr` |
| `removeChild` | <T_5\>(`child`: `T_5`) => `T_5` |
| `removeEventListener` | <K_1\>(`type`: `K_1`, `listener`: (`this`: `HTMLElement`, `ev`: `HTMLElementEventMap`[`K_1`]) => `any`, `options?`: `boolean` \| `EventListenerOptions`) => `void`(`type`: `string`, `listener`: `EventListenerOrEventListenerObject`, `options?`: `boolean` \| `EventListenerOptions`) => `void` |
| `replaceChild` | <T_6\>(`node`: `Node`, `child`: `T_6`) => `T_6` |
| `replaceChildren` | (...`nodes`: (`string` \| `Node`)[]) => `void` |
| `replaceWith` | (...`nodes`: (`string` \| `Node`)[]) => `void` |
| `requestFullscreen` | (`options?`: `FullscreenOptions`) => `Promise`<`void`\> |
| `requestPointerLock` | () => `void` |
| `scroll` | (`options?`: `ScrollToOptions`) => `void`(`x`: `number`, `y`: `number`) => `void` |
| `scrollBy` | (`options?`: `ScrollToOptions`) => `void`(`x`: `number`, `y`: `number`) => `void` |
| `scrollIntoView` | (`arg?`: `boolean` \| `ScrollIntoViewOptions`) => `void` |
| `scrollTo` | (`options?`: `ScrollToOptions`) => `void`(`x`: `number`, `y`: `number`) => `void` |
| `setAttribute` | (`qualifiedName`: `string`, `value`: `string`) => `void` |
| `setAttributeNS` | (`namespace`: `string`, `qualifiedName`: `string`, `value`: `string`) => `void` |
| `setAttributeNode` | (`attr`: `Attr`) => `Attr` |
| `setAttributeNodeNS` | (`attr`: `Attr`) => `Attr` |
| `setPointerCapture` | (`pointerId`: `number`) => `void` |
| `showPopover` | () => `void` |
| `toggleAttribute` | (`qualifiedName`: `string`, `force?`: `boolean`) => `boolean` |
| `togglePopover` | (`force?`: `boolean`) => `void` |
| `webkitMatchesSelector` | (`selectors`: `string`) => `boolean` |

| Name | Type |
| :------ | :------ |
| `stylesheets` | `Set`<`string`\> |
| `tag` | `string` |
| `template` | [`FunctionTemplate`](plaited.index.md#functiontemplate)<[`AdditionalAttrs`](../interfaces/plaited.index.AdditionalAttrs.md) & { `slots`: `never`  }\> |

#### Defined in

libs/component/dist/component.d.ts:12

___

### Fragment

▸ **Fragment**(`«destructured»`): `Object`

#### Parameters

| Name | Type |
| :------ | :------ |
| `«destructured»` | [`Attrs`](plaited.index.md#attrs) |

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `content` | `string` |
| `stylesheets` | `Set`<`string`\> |

#### Defined in

libs/jsx/dist/create-template.d.ts:5

___

### bProgram

▸ **bProgram**(`«destructured»?`): `Readonly`<{ `addThreads`: (`threads`: `Record`<`string`, [`RulesFunc`](plaited.index.md#rulesfunc)\>) => `void` ; `feedback`: [`Feedback`](plaited.index.md#feedback) ; `loop`: (`rules`: [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\>[], `condition?`: () => `boolean`) => [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\> ; `sync`: <T\>(`set`: [`RuleSet`](plaited.index.md#ruleset)<`T`\>) => [`RulesFunc`](plaited.index.md#rulesfunc)<`T`\> ; `thread`: (...`rules`: [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\>[]) => [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\> ; `trigger`: [`Trigger`](plaited.index.md#trigger)  }\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `«destructured»` | `Object` |
| › `dev?` | [`DevCallback`](../interfaces/plaited.index.DevCallback.md) |
| › `strategy?` | ``"priority"`` \| ``"randomized"`` \| ``"chaos"`` \| [`Strategy`](plaited.index.md#strategy) |

#### Returns

`Readonly`<{ `addThreads`: (`threads`: `Record`<`string`, [`RulesFunc`](plaited.index.md#rulesfunc)\>) => `void` ; `feedback`: [`Feedback`](plaited.index.md#feedback) ; `loop`: (`rules`: [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\>[], `condition?`: () => `boolean`) => [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\> ; `sync`: <T\>(`set`: [`RuleSet`](plaited.index.md#ruleset)<`T`\>) => [`RulesFunc`](plaited.index.md#rulesfunc)<`T`\> ; `thread`: (...`rules`: [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\>[]) => [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\> ; `trigger`: [`Trigger`](plaited.index.md#trigger)  }\>

#### Defined in

libs/behavioral/dist/b-program.d.ts:3

___

### classNames

▸ **classNames**(`...classes`): `string`

takes an array of conditional css class name strings and returns them concatenated

#### Parameters

| Name | Type |
| :------ | :------ |
| `...classes` | `ClassNameProps` |

#### Returns

`string`

#### Defined in

libs/jsx/dist/class-names.d.ts:3

___

### createTemplate

▸ **createTemplate**<`T`\>(`tag`, `attrs`): [`Template`](plaited.index.md#template)

createTemplate function used for ssr

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`AdditionalAttrs`](../interfaces/plaited.index.AdditionalAttrs.md) |

#### Parameters

| Name | Type |
| :------ | :------ |
| `tag` | `Tag` |
| `attrs` | [`Attrs`](plaited.index.md#attrs)<`T`\> |

#### Returns

[`Template`](plaited.index.md#template)

#### Defined in

libs/jsx/dist/types.d.ts:36

___

### css

▸ **css**(`strings`, `...expressions`): readonly [`Record`<`string`, `string`\>, { `stylesheet`: `string`  }]

tagged template function for creating css module style styles and classNames objects

#### Parameters

| Name | Type |
| :------ | :------ |
| `strings` | `TemplateStringsArray` |
| `...expressions` | ([`Primitive`](plaited.index.md#primitive) \| [`Primitive`](plaited.index.md#primitive)[])[] |

#### Returns

readonly [`Record`<`string`, `string`\>, { `stylesheet`: `string`  }]

#### Defined in

libs/jsx/dist/css.d.ts:3

___

### loop

▸ **loop**(`rules`, `condition?`): [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `rules` | [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\>[] |
| `condition?` | () => `boolean` |

#### Returns

[`RulesFunc`](plaited.index.md#rulesfunc)<`any`\>

**`Description`**

A behavioral thread that loops infinitely or until some callback condition is false
like a mode change open -> close. This function returns a threads

#### Defined in

libs/behavioral/dist/rules.d.ts:12

___

### memo

▸ **memo**<`T`\>(`resultFn`): [`FT`](plaited.index.md#ft)<`T`\>

Forked from  memoize-one
(c) Alexander Reardon - MIT
{@see https://github.com/alexreardon/memoize-one}
In this mode we constrain arguments to a single props object that extends TemplateProps
We also do a basic shallow comparison on the object to cache function result.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `Record`<`string`, `any`\> = `Record`<`string`, `any`\> |

#### Parameters

| Name | Type |
| :------ | :------ |
| `resultFn` | [`FT`](plaited.index.md#ft)<`T`\> |

#### Returns

[`FT`](plaited.index.md#ft)<`T`\>

#### Defined in

libs/jsx/dist/memo.d.ts:9

___

### stylesheets

▸ **stylesheets**(`...sheets`): `Object`

takes an array of conditional stylesheet objects and returns a stylesheet
object with each individual sheet in an array

#### Parameters

| Name | Type |
| :------ | :------ |
| `...sheets` | `StylesheetsProps` |

#### Returns

`Object`

| Name | Type |
| :------ | :------ |
| `stylesheet` | `any`[] |

#### Defined in

libs/jsx/dist/stylesheets.d.ts:6

___

### sync

▸ **sync**<`T`\>(`set`): [`RulesFunc`](plaited.index.md#rulesfunc)<`T`\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `unknown` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `set` | [`RuleSet`](plaited.index.md#ruleset)<`T`\> |

#### Returns

[`RulesFunc`](plaited.index.md#rulesfunc)<`T`\>

**`Description`**

At synchronization points, each behavioral thread specifies three sets of events:
requested events: the threads proposes that these be considered for triggering,
and asks to be notified when any of them occurs; waitFor events: the threads does not request these, but
asks to be notified when any of them is triggered; and blocked events: the
threads currently forbids triggering
any of these events.

#### Defined in

libs/behavioral/dist/rules.d.ts:22

___

### thread

▸ **thread**(`...rules`): [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `...rules` | [`RulesFunc`](plaited.index.md#rulesfunc)<`any`\>[] |

#### Returns

[`RulesFunc`](plaited.index.md#rulesfunc)<`any`\>

**`Description`**

creates a behavioral thread from synchronization sets and/or other  behavioral threads

#### Defined in

libs/behavioral/dist/rules.d.ts:6

___

### useIndexedDB

▸ **useIndexedDB**<`T`\>(`key`, `initialValue?`, `option?`): `Promise`<readonly [`Get`<`T`\>, `Set`<`T`\>]\>

asynchronously get and set indexed db values

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | `unknown` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `key` | `string` |
| `initialValue?` | `T` |
| `option?` | `Object` |
| `option.databaseName` | `string` |
| `option.storeName` | `string` |

#### Returns

`Promise`<readonly [`Get`<`T`\>, `Set`<`T`\>]\>

#### Defined in

libs/component/dist/use-indexed-db.d.ts:8

___

### useMain

▸ **useMain**(`context`, `trigger`): readonly [[`Send`](plaited.index.md#send), () => `void`]

is a hook to allow us to send and receive messages from the main thread in a worker

#### Parameters

| Name | Type |
| :------ | :------ |
| `context` | `Window` & typeof `globalThis` |
| `trigger` | [`Trigger`](plaited.index.md#trigger) |

#### Returns

readonly [[`Send`](plaited.index.md#send), () => `void`]

#### Defined in

libs/component/dist/use-main.d.ts:4

___

### useMessenger

▸ **useMessenger**(`id?`): `Readonly`<{ `connect`: [`Connect`](../interfaces/plaited.index.Connect.md) ; `has`: (`recipient`: `string`) => `boolean` ; `send`: [`Send`](plaited.index.md#send)  }\>

Enables communication between agents in a web app.
Agents can be Islands, workers, or behavioral program running in the main thread.
This allows for execution of the one-way message exchange pattern (aka
fire and forget).

#### Parameters

| Name | Type |
| :------ | :------ |
| `id?` | `string` |

#### Returns

`Readonly`<{ `connect`: [`Connect`](../interfaces/plaited.index.Connect.md) ; `has`: (`recipient`: `string`) => `boolean` ; `send`: [`Send`](plaited.index.md#send)  }\>

readonly {}
  connect: (recipient: string, trigger: [Trigger](plaited.index.md#trigger)) => Disconnect,
  send: (recipient: string, detail: [TriggerArgs](plaited.index.md#triggerargs)) => void
  worker: (id: string, url: string) =>  Disconnect
}

#### Defined in

libs/component/dist/use-messenger.d.ts:12

___

### useStore

▸ **useStore**<`T`\>(`initialStore?`): readonly [`Get`<`T`\>, `Set`<`T`\>]

#### Type parameters

| Name |
| :------ |
| `T` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `initialStore?` | `T` |

#### Returns

readonly [`Get`<`T`\>, `Set`<`T`\>]

**`Description`**

a simple utility function for safely getting and setting values you need to persist during run.
When using the callback feature userStore passes a structured clone of the currently stored value
as a parameter. If you pass a function as nestStore, it will be treated as an updater function. It must be pure, should take the pending state as its only argument,
and should return the next store.

**`Example`**

```ts
const [store, setStore] = useStore<Record<string, number> | number>({ a: 1 })
 setStore((prev) => {
   if (typeof prev !== 'number') prev.b = 2
   return prev
 })
 store() //=> { a: 1, b: 2 }
 setStore(3)
 store() // => 3
```

#### Defined in

libs/utils/dist/use-store.d.ts:23
