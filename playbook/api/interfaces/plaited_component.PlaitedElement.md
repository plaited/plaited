[Plaited Typedocs](../README.md) / [Exports](../modules.md) / [@plaited/component](../modules/plaited_component.md) / PlaitedElement

# Interface: PlaitedElement

[@plaited/component](../modules/plaited_component.md).PlaitedElement

## Hierarchy

- `HTMLElement`

  ↳ **`PlaitedElement`**

## Table of contents

### Properties

- [ATTRIBUTE\_NODE](plaited_component.PlaitedElement.md#attribute_node)
- [CDATA\_SECTION\_NODE](plaited_component.PlaitedElement.md#cdata_section_node)
- [COMMENT\_NODE](plaited_component.PlaitedElement.md#comment_node)
- [DOCUMENT\_FRAGMENT\_NODE](plaited_component.PlaitedElement.md#document_fragment_node)
- [DOCUMENT\_NODE](plaited_component.PlaitedElement.md#document_node)
- [DOCUMENT\_POSITION\_CONTAINED\_BY](plaited_component.PlaitedElement.md#document_position_contained_by)
- [DOCUMENT\_POSITION\_CONTAINS](plaited_component.PlaitedElement.md#document_position_contains)
- [DOCUMENT\_POSITION\_DISCONNECTED](plaited_component.PlaitedElement.md#document_position_disconnected)
- [DOCUMENT\_POSITION\_FOLLOWING](plaited_component.PlaitedElement.md#document_position_following)
- [DOCUMENT\_POSITION\_IMPLEMENTATION\_SPECIFIC](plaited_component.PlaitedElement.md#document_position_implementation_specific)
- [DOCUMENT\_POSITION\_PRECEDING](plaited_component.PlaitedElement.md#document_position_preceding)
- [DOCUMENT\_TYPE\_NODE](plaited_component.PlaitedElement.md#document_type_node)
- [ELEMENT\_NODE](plaited_component.PlaitedElement.md#element_node)
- [ENTITY\_NODE](plaited_component.PlaitedElement.md#entity_node)
- [ENTITY\_REFERENCE\_NODE](plaited_component.PlaitedElement.md#entity_reference_node)
- [NOTATION\_NODE](plaited_component.PlaitedElement.md#notation_node)
- [PROCESSING\_INSTRUCTION\_NODE](plaited_component.PlaitedElement.md#processing_instruction_node)
- [TEXT\_NODE](plaited_component.PlaitedElement.md#text_node)
- [accessKey](plaited_component.PlaitedElement.md#accesskey)
- [accessKeyLabel](plaited_component.PlaitedElement.md#accesskeylabel)
- [ariaAtomic](plaited_component.PlaitedElement.md#ariaatomic)
- [ariaAutoComplete](plaited_component.PlaitedElement.md#ariaautocomplete)
- [ariaBusy](plaited_component.PlaitedElement.md#ariabusy)
- [ariaChecked](plaited_component.PlaitedElement.md#ariachecked)
- [ariaColCount](plaited_component.PlaitedElement.md#ariacolcount)
- [ariaColIndex](plaited_component.PlaitedElement.md#ariacolindex)
- [ariaColSpan](plaited_component.PlaitedElement.md#ariacolspan)
- [ariaCurrent](plaited_component.PlaitedElement.md#ariacurrent)
- [ariaDisabled](plaited_component.PlaitedElement.md#ariadisabled)
- [ariaExpanded](plaited_component.PlaitedElement.md#ariaexpanded)
- [ariaHasPopup](plaited_component.PlaitedElement.md#ariahaspopup)
- [ariaHidden](plaited_component.PlaitedElement.md#ariahidden)
- [ariaInvalid](plaited_component.PlaitedElement.md#ariainvalid)
- [ariaKeyShortcuts](plaited_component.PlaitedElement.md#ariakeyshortcuts)
- [ariaLabel](plaited_component.PlaitedElement.md#arialabel)
- [ariaLevel](plaited_component.PlaitedElement.md#arialevel)
- [ariaLive](plaited_component.PlaitedElement.md#arialive)
- [ariaModal](plaited_component.PlaitedElement.md#ariamodal)
- [ariaMultiLine](plaited_component.PlaitedElement.md#ariamultiline)
- [ariaMultiSelectable](plaited_component.PlaitedElement.md#ariamultiselectable)
- [ariaOrientation](plaited_component.PlaitedElement.md#ariaorientation)
- [ariaPlaceholder](plaited_component.PlaitedElement.md#ariaplaceholder)
- [ariaPosInSet](plaited_component.PlaitedElement.md#ariaposinset)
- [ariaPressed](plaited_component.PlaitedElement.md#ariapressed)
- [ariaReadOnly](plaited_component.PlaitedElement.md#ariareadonly)
- [ariaRequired](plaited_component.PlaitedElement.md#ariarequired)
- [ariaRoleDescription](plaited_component.PlaitedElement.md#ariaroledescription)
- [ariaRowCount](plaited_component.PlaitedElement.md#ariarowcount)
- [ariaRowIndex](plaited_component.PlaitedElement.md#ariarowindex)
- [ariaRowSpan](plaited_component.PlaitedElement.md#ariarowspan)
- [ariaSelected](plaited_component.PlaitedElement.md#ariaselected)
- [ariaSetSize](plaited_component.PlaitedElement.md#ariasetsize)
- [ariaSort](plaited_component.PlaitedElement.md#ariasort)
- [ariaValueMax](plaited_component.PlaitedElement.md#ariavaluemax)
- [ariaValueMin](plaited_component.PlaitedElement.md#ariavaluemin)
- [ariaValueNow](plaited_component.PlaitedElement.md#ariavaluenow)
- [ariaValueText](plaited_component.PlaitedElement.md#ariavaluetext)
- [assignedSlot](plaited_component.PlaitedElement.md#assignedslot)
- [attributeStyleMap](plaited_component.PlaitedElement.md#attributestylemap)
- [attributes](plaited_component.PlaitedElement.md#attributes)
- [autocapitalize](plaited_component.PlaitedElement.md#autocapitalize)
- [autofocus](plaited_component.PlaitedElement.md#autofocus)
- [baseURI](plaited_component.PlaitedElement.md#baseuri)
- [childElementCount](plaited_component.PlaitedElement.md#childelementcount)
- [childNodes](plaited_component.PlaitedElement.md#childnodes)
- [children](plaited_component.PlaitedElement.md#children)
- [classList](plaited_component.PlaitedElement.md#classlist)
- [className](plaited_component.PlaitedElement.md#classname)
- [clientHeight](plaited_component.PlaitedElement.md#clientheight)
- [clientLeft](plaited_component.PlaitedElement.md#clientleft)
- [clientTop](plaited_component.PlaitedElement.md#clienttop)
- [clientWidth](plaited_component.PlaitedElement.md#clientwidth)
- [contentEditable](plaited_component.PlaitedElement.md#contenteditable)
- [dataset](plaited_component.PlaitedElement.md#dataset)
- [dir](plaited_component.PlaitedElement.md#dir)
- [draggable](plaited_component.PlaitedElement.md#draggable)
- [enterKeyHint](plaited_component.PlaitedElement.md#enterkeyhint)
- [firstChild](plaited_component.PlaitedElement.md#firstchild)
- [firstElementChild](plaited_component.PlaitedElement.md#firstelementchild)
- [hidden](plaited_component.PlaitedElement.md#hidden)
- [id](plaited_component.PlaitedElement.md#id)
- [inert](plaited_component.PlaitedElement.md#inert)
- [innerHTML](plaited_component.PlaitedElement.md#innerhtml)
- [innerText](plaited_component.PlaitedElement.md#innertext)
- [inputMode](plaited_component.PlaitedElement.md#inputmode)
- [internals\_](plaited_component.PlaitedElement.md#internals_)
- [isConnected](plaited_component.PlaitedElement.md#isconnected)
- [isContentEditable](plaited_component.PlaitedElement.md#iscontenteditable)
- [lang](plaited_component.PlaitedElement.md#lang)
- [lastChild](plaited_component.PlaitedElement.md#lastchild)
- [lastElementChild](plaited_component.PlaitedElement.md#lastelementchild)
- [localName](plaited_component.PlaitedElement.md#localname)
- [namespaceURI](plaited_component.PlaitedElement.md#namespaceuri)
- [nextElementSibling](plaited_component.PlaitedElement.md#nextelementsibling)
- [nextSibling](plaited_component.PlaitedElement.md#nextsibling)
- [nodeName](plaited_component.PlaitedElement.md#nodename)
- [nodeType](plaited_component.PlaitedElement.md#nodetype)
- [nodeValue](plaited_component.PlaitedElement.md#nodevalue)
- [nonce](plaited_component.PlaitedElement.md#nonce)
- [offsetHeight](plaited_component.PlaitedElement.md#offsetheight)
- [offsetLeft](plaited_component.PlaitedElement.md#offsetleft)
- [offsetParent](plaited_component.PlaitedElement.md#offsetparent)
- [offsetTop](plaited_component.PlaitedElement.md#offsettop)
- [offsetWidth](plaited_component.PlaitedElement.md#offsetwidth)
- [onabort](plaited_component.PlaitedElement.md#onabort)
- [onanimationcancel](plaited_component.PlaitedElement.md#onanimationcancel)
- [onanimationend](plaited_component.PlaitedElement.md#onanimationend)
- [onanimationiteration](plaited_component.PlaitedElement.md#onanimationiteration)
- [onanimationstart](plaited_component.PlaitedElement.md#onanimationstart)
- [onauxclick](plaited_component.PlaitedElement.md#onauxclick)
- [onbeforeinput](plaited_component.PlaitedElement.md#onbeforeinput)
- [onblur](plaited_component.PlaitedElement.md#onblur)
- [oncancel](plaited_component.PlaitedElement.md#oncancel)
- [oncanplay](plaited_component.PlaitedElement.md#oncanplay)
- [oncanplaythrough](plaited_component.PlaitedElement.md#oncanplaythrough)
- [onchange](plaited_component.PlaitedElement.md#onchange)
- [onclick](plaited_component.PlaitedElement.md#onclick)
- [onclose](plaited_component.PlaitedElement.md#onclose)
- [oncontextmenu](plaited_component.PlaitedElement.md#oncontextmenu)
- [oncopy](plaited_component.PlaitedElement.md#oncopy)
- [oncuechange](plaited_component.PlaitedElement.md#oncuechange)
- [oncut](plaited_component.PlaitedElement.md#oncut)
- [ondblclick](plaited_component.PlaitedElement.md#ondblclick)
- [ondrag](plaited_component.PlaitedElement.md#ondrag)
- [ondragend](plaited_component.PlaitedElement.md#ondragend)
- [ondragenter](plaited_component.PlaitedElement.md#ondragenter)
- [ondragleave](plaited_component.PlaitedElement.md#ondragleave)
- [ondragover](plaited_component.PlaitedElement.md#ondragover)
- [ondragstart](plaited_component.PlaitedElement.md#ondragstart)
- [ondrop](plaited_component.PlaitedElement.md#ondrop)
- [ondurationchange](plaited_component.PlaitedElement.md#ondurationchange)
- [onemptied](plaited_component.PlaitedElement.md#onemptied)
- [onended](plaited_component.PlaitedElement.md#onended)
- [onerror](plaited_component.PlaitedElement.md#onerror)
- [onfocus](plaited_component.PlaitedElement.md#onfocus)
- [onformdata](plaited_component.PlaitedElement.md#onformdata)
- [onfullscreenchange](plaited_component.PlaitedElement.md#onfullscreenchange)
- [onfullscreenerror](plaited_component.PlaitedElement.md#onfullscreenerror)
- [ongotpointercapture](plaited_component.PlaitedElement.md#ongotpointercapture)
- [oninput](plaited_component.PlaitedElement.md#oninput)
- [oninvalid](plaited_component.PlaitedElement.md#oninvalid)
- [onkeydown](plaited_component.PlaitedElement.md#onkeydown)
- [onkeypress](plaited_component.PlaitedElement.md#onkeypress)
- [onkeyup](plaited_component.PlaitedElement.md#onkeyup)
- [onload](plaited_component.PlaitedElement.md#onload)
- [onloadeddata](plaited_component.PlaitedElement.md#onloadeddata)
- [onloadedmetadata](plaited_component.PlaitedElement.md#onloadedmetadata)
- [onloadstart](plaited_component.PlaitedElement.md#onloadstart)
- [onlostpointercapture](plaited_component.PlaitedElement.md#onlostpointercapture)
- [onmousedown](plaited_component.PlaitedElement.md#onmousedown)
- [onmouseenter](plaited_component.PlaitedElement.md#onmouseenter)
- [onmouseleave](plaited_component.PlaitedElement.md#onmouseleave)
- [onmousemove](plaited_component.PlaitedElement.md#onmousemove)
- [onmouseout](plaited_component.PlaitedElement.md#onmouseout)
- [onmouseover](plaited_component.PlaitedElement.md#onmouseover)
- [onmouseup](plaited_component.PlaitedElement.md#onmouseup)
- [onpaste](plaited_component.PlaitedElement.md#onpaste)
- [onpause](plaited_component.PlaitedElement.md#onpause)
- [onplay](plaited_component.PlaitedElement.md#onplay)
- [onplaying](plaited_component.PlaitedElement.md#onplaying)
- [onpointercancel](plaited_component.PlaitedElement.md#onpointercancel)
- [onpointerdown](plaited_component.PlaitedElement.md#onpointerdown)
- [onpointerenter](plaited_component.PlaitedElement.md#onpointerenter)
- [onpointerleave](plaited_component.PlaitedElement.md#onpointerleave)
- [onpointermove](plaited_component.PlaitedElement.md#onpointermove)
- [onpointerout](plaited_component.PlaitedElement.md#onpointerout)
- [onpointerover](plaited_component.PlaitedElement.md#onpointerover)
- [onpointerup](plaited_component.PlaitedElement.md#onpointerup)
- [onprogress](plaited_component.PlaitedElement.md#onprogress)
- [onratechange](plaited_component.PlaitedElement.md#onratechange)
- [onreset](plaited_component.PlaitedElement.md#onreset)
- [onresize](plaited_component.PlaitedElement.md#onresize)
- [onscroll](plaited_component.PlaitedElement.md#onscroll)
- [onscrollend](plaited_component.PlaitedElement.md#onscrollend)
- [onsecuritypolicyviolation](plaited_component.PlaitedElement.md#onsecuritypolicyviolation)
- [onseeked](plaited_component.PlaitedElement.md#onseeked)
- [onseeking](plaited_component.PlaitedElement.md#onseeking)
- [onselect](plaited_component.PlaitedElement.md#onselect)
- [onselectionchange](plaited_component.PlaitedElement.md#onselectionchange)
- [onselectstart](plaited_component.PlaitedElement.md#onselectstart)
- [onslotchange](plaited_component.PlaitedElement.md#onslotchange)
- [onstalled](plaited_component.PlaitedElement.md#onstalled)
- [onsubmit](plaited_component.PlaitedElement.md#onsubmit)
- [onsuspend](plaited_component.PlaitedElement.md#onsuspend)
- [ontimeupdate](plaited_component.PlaitedElement.md#ontimeupdate)
- [ontoggle](plaited_component.PlaitedElement.md#ontoggle)
- [ontouchcancel](plaited_component.PlaitedElement.md#ontouchcancel)
- [ontouchend](plaited_component.PlaitedElement.md#ontouchend)
- [ontouchmove](plaited_component.PlaitedElement.md#ontouchmove)
- [ontouchstart](plaited_component.PlaitedElement.md#ontouchstart)
- [ontransitioncancel](plaited_component.PlaitedElement.md#ontransitioncancel)
- [ontransitionend](plaited_component.PlaitedElement.md#ontransitionend)
- [ontransitionrun](plaited_component.PlaitedElement.md#ontransitionrun)
- [ontransitionstart](plaited_component.PlaitedElement.md#ontransitionstart)
- [onvolumechange](plaited_component.PlaitedElement.md#onvolumechange)
- [onwaiting](plaited_component.PlaitedElement.md#onwaiting)
- [onwebkitanimationend](plaited_component.PlaitedElement.md#onwebkitanimationend)
- [onwebkitanimationiteration](plaited_component.PlaitedElement.md#onwebkitanimationiteration)
- [onwebkitanimationstart](plaited_component.PlaitedElement.md#onwebkitanimationstart)
- [onwebkittransitionend](plaited_component.PlaitedElement.md#onwebkittransitionend)
- [onwheel](plaited_component.PlaitedElement.md#onwheel)
- [outerHTML](plaited_component.PlaitedElement.md#outerhtml)
- [outerText](plaited_component.PlaitedElement.md#outertext)
- [ownerDocument](plaited_component.PlaitedElement.md#ownerdocument)
- [parentElement](plaited_component.PlaitedElement.md#parentelement)
- [parentNode](plaited_component.PlaitedElement.md#parentnode)
- [part](plaited_component.PlaitedElement.md#part)
- [popover](plaited_component.PlaitedElement.md#popover)
- [prefix](plaited_component.PlaitedElement.md#prefix)
- [previousElementSibling](plaited_component.PlaitedElement.md#previouselementsibling)
- [previousSibling](plaited_component.PlaitedElement.md#previoussibling)
- [role](plaited_component.PlaitedElement.md#role)
- [scrollHeight](plaited_component.PlaitedElement.md#scrollheight)
- [scrollLeft](plaited_component.PlaitedElement.md#scrollleft)
- [scrollTop](plaited_component.PlaitedElement.md#scrolltop)
- [scrollWidth](plaited_component.PlaitedElement.md#scrollwidth)
- [shadowRoot](plaited_component.PlaitedElement.md#shadowroot)
- [slot](plaited_component.PlaitedElement.md#slot)
- [spellcheck](plaited_component.PlaitedElement.md#spellcheck)
- [style](plaited_component.PlaitedElement.md#style)
- [tabIndex](plaited_component.PlaitedElement.md#tabindex)
- [tagName](plaited_component.PlaitedElement.md#tagname)
- [textContent](plaited_component.PlaitedElement.md#textcontent)
- [title](plaited_component.PlaitedElement.md#title)
- [translate](plaited_component.PlaitedElement.md#translate)

### Methods

- [addEventListener](plaited_component.PlaitedElement.md#addeventlistener)
- [adoptedCallback](plaited_component.PlaitedElement.md#adoptedcallback)
- [after](plaited_component.PlaitedElement.md#after)
- [animate](plaited_component.PlaitedElement.md#animate)
- [append](plaited_component.PlaitedElement.md#append)
- [appendChild](plaited_component.PlaitedElement.md#appendchild)
- [attachInternals](plaited_component.PlaitedElement.md#attachinternals)
- [attachShadow](plaited_component.PlaitedElement.md#attachshadow)
- [attributeChangedCallback](plaited_component.PlaitedElement.md#attributechangedcallback)
- [before](plaited_component.PlaitedElement.md#before)
- [blur](plaited_component.PlaitedElement.md#blur)
- [checkVisibility](plaited_component.PlaitedElement.md#checkvisibility)
- [click](plaited_component.PlaitedElement.md#click)
- [cloneNode](plaited_component.PlaitedElement.md#clonenode)
- [closest](plaited_component.PlaitedElement.md#closest)
- [compareDocumentPosition](plaited_component.PlaitedElement.md#comparedocumentposition)
- [computedStyleMap](plaited_component.PlaitedElement.md#computedstylemap)
- [connectedCallback](plaited_component.PlaitedElement.md#connectedcallback)
- [contains](plaited_component.PlaitedElement.md#contains)
- [disconnectedCallback](plaited_component.PlaitedElement.md#disconnectedcallback)
- [dispatchEvent](plaited_component.PlaitedElement.md#dispatchevent)
- [focus](plaited_component.PlaitedElement.md#focus)
- [formAssociatedCallback](plaited_component.PlaitedElement.md#formassociatedcallback)
- [formDisabledCallback](plaited_component.PlaitedElement.md#formdisabledcallback)
- [formResetCallback](plaited_component.PlaitedElement.md#formresetcallback)
- [formStateRestoreCallback](plaited_component.PlaitedElement.md#formstaterestorecallback)
- [getAnimations](plaited_component.PlaitedElement.md#getanimations)
- [getAttribute](plaited_component.PlaitedElement.md#getattribute)
- [getAttributeNS](plaited_component.PlaitedElement.md#getattributens)
- [getAttributeNames](plaited_component.PlaitedElement.md#getattributenames)
- [getAttributeNode](plaited_component.PlaitedElement.md#getattributenode)
- [getAttributeNodeNS](plaited_component.PlaitedElement.md#getattributenodens)
- [getBoundingClientRect](plaited_component.PlaitedElement.md#getboundingclientrect)
- [getClientRects](plaited_component.PlaitedElement.md#getclientrects)
- [getElementsByClassName](plaited_component.PlaitedElement.md#getelementsbyclassname)
- [getElementsByTagName](plaited_component.PlaitedElement.md#getelementsbytagname)
- [getElementsByTagNameNS](plaited_component.PlaitedElement.md#getelementsbytagnamens)
- [getRootNode](plaited_component.PlaitedElement.md#getrootnode)
- [hasAttribute](plaited_component.PlaitedElement.md#hasattribute)
- [hasAttributeNS](plaited_component.PlaitedElement.md#hasattributens)
- [hasAttributes](plaited_component.PlaitedElement.md#hasattributes)
- [hasChildNodes](plaited_component.PlaitedElement.md#haschildnodes)
- [hasPointerCapture](plaited_component.PlaitedElement.md#haspointercapture)
- [hidePopover](plaited_component.PlaitedElement.md#hidepopover)
- [insertAdjacentElement](plaited_component.PlaitedElement.md#insertadjacentelement)
- [insertAdjacentHTML](plaited_component.PlaitedElement.md#insertadjacenthtml)
- [insertAdjacentText](plaited_component.PlaitedElement.md#insertadjacenttext)
- [insertBefore](plaited_component.PlaitedElement.md#insertbefore)
- [isDefaultNamespace](plaited_component.PlaitedElement.md#isdefaultnamespace)
- [isEqualNode](plaited_component.PlaitedElement.md#isequalnode)
- [isSameNode](plaited_component.PlaitedElement.md#issamenode)
- [lookupNamespaceURI](plaited_component.PlaitedElement.md#lookupnamespaceuri)
- [lookupPrefix](plaited_component.PlaitedElement.md#lookupprefix)
- [matches](plaited_component.PlaitedElement.md#matches)
- [normalize](plaited_component.PlaitedElement.md#normalize)
- [plait](plaited_component.PlaitedElement.md#plait)
- [prepend](plaited_component.PlaitedElement.md#prepend)
- [querySelector](plaited_component.PlaitedElement.md#queryselector)
- [querySelectorAll](plaited_component.PlaitedElement.md#queryselectorall)
- [releasePointerCapture](plaited_component.PlaitedElement.md#releasepointercapture)
- [remove](plaited_component.PlaitedElement.md#remove)
- [removeAttribute](plaited_component.PlaitedElement.md#removeattribute)
- [removeAttributeNS](plaited_component.PlaitedElement.md#removeattributens)
- [removeAttributeNode](plaited_component.PlaitedElement.md#removeattributenode)
- [removeChild](plaited_component.PlaitedElement.md#removechild)
- [removeEventListener](plaited_component.PlaitedElement.md#removeeventlistener)
- [replaceChild](plaited_component.PlaitedElement.md#replacechild)
- [replaceChildren](plaited_component.PlaitedElement.md#replacechildren)
- [replaceWith](plaited_component.PlaitedElement.md#replacewith)
- [requestFullscreen](plaited_component.PlaitedElement.md#requestfullscreen)
- [requestPointerLock](plaited_component.PlaitedElement.md#requestpointerlock)
- [scroll](plaited_component.PlaitedElement.md#scroll)
- [scrollBy](plaited_component.PlaitedElement.md#scrollby)
- [scrollIntoView](plaited_component.PlaitedElement.md#scrollintoview)
- [scrollTo](plaited_component.PlaitedElement.md#scrollto)
- [setAttribute](plaited_component.PlaitedElement.md#setattribute)
- [setAttributeNS](plaited_component.PlaitedElement.md#setattributens)
- [setAttributeNode](plaited_component.PlaitedElement.md#setattributenode)
- [setAttributeNodeNS](plaited_component.PlaitedElement.md#setattributenodens)
- [setPointerCapture](plaited_component.PlaitedElement.md#setpointercapture)
- [showPopover](plaited_component.PlaitedElement.md#showpopover)
- [toggleAttribute](plaited_component.PlaitedElement.md#toggleattribute)
- [togglePopover](plaited_component.PlaitedElement.md#togglepopover)
- [webkitMatchesSelector](plaited_component.PlaitedElement.md#webkitmatchesselector)

## Properties

### ATTRIBUTE\_NODE

• `Readonly` **ATTRIBUTE\_NODE**: ``2``

#### Inherited from

HTMLElement.ATTRIBUTE\_NODE

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16203

___

### CDATA\_SECTION\_NODE

• `Readonly` **CDATA\_SECTION\_NODE**: ``4``

node is a CDATASection node.

#### Inherited from

HTMLElement.CDATA\_SECTION\_NODE

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16207

___

### COMMENT\_NODE

• `Readonly` **COMMENT\_NODE**: ``8``

node is a Comment node.

#### Inherited from

HTMLElement.COMMENT\_NODE

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16213

___

### DOCUMENT\_FRAGMENT\_NODE

• `Readonly` **DOCUMENT\_FRAGMENT\_NODE**: ``11``

node is a DocumentFragment node.

#### Inherited from

HTMLElement.DOCUMENT\_FRAGMENT\_NODE

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16219

___

### DOCUMENT\_NODE

• `Readonly` **DOCUMENT\_NODE**: ``9``

node is a document.

#### Inherited from

HTMLElement.DOCUMENT\_NODE

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16215

___

### DOCUMENT\_POSITION\_CONTAINED\_BY

• `Readonly` **DOCUMENT\_POSITION\_CONTAINED\_BY**: ``16``

Set when other is a descendant of node.

#### Inherited from

HTMLElement.DOCUMENT\_POSITION\_CONTAINED\_BY

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16230

___

### DOCUMENT\_POSITION\_CONTAINS

• `Readonly` **DOCUMENT\_POSITION\_CONTAINS**: ``8``

Set when other is an ancestor of node.

#### Inherited from

HTMLElement.DOCUMENT\_POSITION\_CONTAINS

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16228

___

### DOCUMENT\_POSITION\_DISCONNECTED

• `Readonly` **DOCUMENT\_POSITION\_DISCONNECTED**: ``1``

Set when node and other are not in the same tree.

#### Inherited from

HTMLElement.DOCUMENT\_POSITION\_DISCONNECTED

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16222

___

### DOCUMENT\_POSITION\_FOLLOWING

• `Readonly` **DOCUMENT\_POSITION\_FOLLOWING**: ``4``

Set when other is following node.

#### Inherited from

HTMLElement.DOCUMENT\_POSITION\_FOLLOWING

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16226

___

### DOCUMENT\_POSITION\_IMPLEMENTATION\_SPECIFIC

• `Readonly` **DOCUMENT\_POSITION\_IMPLEMENTATION\_SPECIFIC**: ``32``

#### Inherited from

HTMLElement.DOCUMENT\_POSITION\_IMPLEMENTATION\_SPECIFIC

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16231

___

### DOCUMENT\_POSITION\_PRECEDING

• `Readonly` **DOCUMENT\_POSITION\_PRECEDING**: ``2``

Set when other is preceding node.

#### Inherited from

HTMLElement.DOCUMENT\_POSITION\_PRECEDING

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16224

___

### DOCUMENT\_TYPE\_NODE

• `Readonly` **DOCUMENT\_TYPE\_NODE**: ``10``

node is a doctype.

#### Inherited from

HTMLElement.DOCUMENT\_TYPE\_NODE

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16217

___

### ELEMENT\_NODE

• `Readonly` **ELEMENT\_NODE**: ``1``

node is an element.

#### Inherited from

HTMLElement.ELEMENT\_NODE

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16202

___

### ENTITY\_NODE

• `Readonly` **ENTITY\_NODE**: ``6``

#### Inherited from

HTMLElement.ENTITY\_NODE

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16209

___

### ENTITY\_REFERENCE\_NODE

• `Readonly` **ENTITY\_REFERENCE\_NODE**: ``5``

#### Inherited from

HTMLElement.ENTITY\_REFERENCE\_NODE

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16208

___

### NOTATION\_NODE

• `Readonly` **NOTATION\_NODE**: ``12``

#### Inherited from

HTMLElement.NOTATION\_NODE

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16220

___

### PROCESSING\_INSTRUCTION\_NODE

• `Readonly` **PROCESSING\_INSTRUCTION\_NODE**: ``7``

node is a ProcessingInstruction node.

#### Inherited from

HTMLElement.PROCESSING\_INSTRUCTION\_NODE

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16211

___

### TEXT\_NODE

• `Readonly` **TEXT\_NODE**: ``3``

node is a Text node.

#### Inherited from

HTMLElement.TEXT\_NODE

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16205

___

### accessKey

• **accessKey**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/accessKey)

#### Inherited from

HTMLElement.accessKey

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:10051

___

### accessKeyLabel

• `Readonly` **accessKeyLabel**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/accessKeyLabel)

#### Inherited from

HTMLElement.accessKeyLabel

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:10053

___

### ariaAtomic

• **ariaAtomic**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaAtomic)

#### Inherited from

HTMLElement.ariaAtomic

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2207

___

### ariaAutoComplete

• **ariaAutoComplete**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaAutoComplete)

#### Inherited from

HTMLElement.ariaAutoComplete

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2209

___

### ariaBusy

• **ariaBusy**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaBusy)

#### Inherited from

HTMLElement.ariaBusy

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2211

___

### ariaChecked

• **ariaChecked**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaChecked)

#### Inherited from

HTMLElement.ariaChecked

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2213

___

### ariaColCount

• **ariaColCount**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaColCount)

#### Inherited from

HTMLElement.ariaColCount

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2215

___

### ariaColIndex

• **ariaColIndex**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaColIndex)

#### Inherited from

HTMLElement.ariaColIndex

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2217

___

### ariaColSpan

• **ariaColSpan**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaColSpan)

#### Inherited from

HTMLElement.ariaColSpan

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2219

___

### ariaCurrent

• **ariaCurrent**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaCurrent)

#### Inherited from

HTMLElement.ariaCurrent

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2221

___

### ariaDisabled

• **ariaDisabled**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaDisabled)

#### Inherited from

HTMLElement.ariaDisabled

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2223

___

### ariaExpanded

• **ariaExpanded**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaExpanded)

#### Inherited from

HTMLElement.ariaExpanded

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2225

___

### ariaHasPopup

• **ariaHasPopup**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaHasPopup)

#### Inherited from

HTMLElement.ariaHasPopup

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2227

___

### ariaHidden

• **ariaHidden**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaHidden)

#### Inherited from

HTMLElement.ariaHidden

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2229

___

### ariaInvalid

• **ariaInvalid**: `string`

#### Inherited from

HTMLElement.ariaInvalid

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2230

___

### ariaKeyShortcuts

• **ariaKeyShortcuts**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaKeyShortcuts)

#### Inherited from

HTMLElement.ariaKeyShortcuts

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2232

___

### ariaLabel

• **ariaLabel**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaLabel)

#### Inherited from

HTMLElement.ariaLabel

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2234

___

### ariaLevel

• **ariaLevel**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaLevel)

#### Inherited from

HTMLElement.ariaLevel

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2236

___

### ariaLive

• **ariaLive**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaLive)

#### Inherited from

HTMLElement.ariaLive

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2238

___

### ariaModal

• **ariaModal**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaModal)

#### Inherited from

HTMLElement.ariaModal

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2240

___

### ariaMultiLine

• **ariaMultiLine**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaMultiLine)

#### Inherited from

HTMLElement.ariaMultiLine

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2242

___

### ariaMultiSelectable

• **ariaMultiSelectable**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaMultiSelectable)

#### Inherited from

HTMLElement.ariaMultiSelectable

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2244

___

### ariaOrientation

• **ariaOrientation**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaOrientation)

#### Inherited from

HTMLElement.ariaOrientation

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2246

___

### ariaPlaceholder

• **ariaPlaceholder**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaPlaceholder)

#### Inherited from

HTMLElement.ariaPlaceholder

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2248

___

### ariaPosInSet

• **ariaPosInSet**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaPosInSet)

#### Inherited from

HTMLElement.ariaPosInSet

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2250

___

### ariaPressed

• **ariaPressed**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaPressed)

#### Inherited from

HTMLElement.ariaPressed

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2252

___

### ariaReadOnly

• **ariaReadOnly**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaReadOnly)

#### Inherited from

HTMLElement.ariaReadOnly

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2254

___

### ariaRequired

• **ariaRequired**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaRequired)

#### Inherited from

HTMLElement.ariaRequired

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2256

___

### ariaRoleDescription

• **ariaRoleDescription**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaRoleDescription)

#### Inherited from

HTMLElement.ariaRoleDescription

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2258

___

### ariaRowCount

• **ariaRowCount**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaRowCount)

#### Inherited from

HTMLElement.ariaRowCount

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2260

___

### ariaRowIndex

• **ariaRowIndex**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaRowIndex)

#### Inherited from

HTMLElement.ariaRowIndex

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2262

___

### ariaRowSpan

• **ariaRowSpan**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaRowSpan)

#### Inherited from

HTMLElement.ariaRowSpan

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2264

___

### ariaSelected

• **ariaSelected**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaSelected)

#### Inherited from

HTMLElement.ariaSelected

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2266

___

### ariaSetSize

• **ariaSetSize**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaSetSize)

#### Inherited from

HTMLElement.ariaSetSize

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2268

___

### ariaSort

• **ariaSort**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaSort)

#### Inherited from

HTMLElement.ariaSort

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2270

___

### ariaValueMax

• **ariaValueMax**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaValueMax)

#### Inherited from

HTMLElement.ariaValueMax

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2272

___

### ariaValueMin

• **ariaValueMin**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaValueMin)

#### Inherited from

HTMLElement.ariaValueMin

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2274

___

### ariaValueNow

• **ariaValueNow**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaValueNow)

#### Inherited from

HTMLElement.ariaValueNow

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2276

___

### ariaValueText

• **ariaValueText**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaValueText)

#### Inherited from

HTMLElement.ariaValueText

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2278

___

### assignedSlot

• `Readonly` **assignedSlot**: `HTMLSlotElement`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/assignedSlot)

#### Inherited from

HTMLElement.assignedSlot

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:21294

___

### attributeStyleMap

• `Readonly` **attributeStyleMap**: `StylePropertyMap`

#### Inherited from

HTMLElement.attributeStyleMap

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7853

___

### attributes

• `Readonly` **attributes**: `NamedNodeMap`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/attributes)

#### Inherited from

HTMLElement.attributes

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7598

___

### autocapitalize

• **autocapitalize**: `string`

#### Inherited from

HTMLElement.autocapitalize

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:10054

___

### autofocus

• **autofocus**: `boolean`

#### Inherited from

HTMLElement.autofocus

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:12043

___

### baseURI

• `Readonly` **baseURI**: `string`

Returns node's node document's document base URL.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/baseURI)

#### Inherited from

HTMLElement.baseURI

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16072

___

### childElementCount

• `Readonly` **childElementCount**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Document/childElementCount)

#### Inherited from

HTMLElement.childElementCount

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16761

___

### childNodes

• `Readonly` **childNodes**: `NodeListOf`<`ChildNode`\>

Returns the children.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/childNodes)

#### Inherited from

HTMLElement.childNodes

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16078

___

### children

• `Readonly` **children**: `HTMLCollection`

Returns the child elements.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Document/children)

#### Inherited from

HTMLElement.children

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16767

___

### classList

• `Readonly` **classList**: `DOMTokenList`

Allows for manipulation of element's class content attribute as a set of whitespace-separated tokens through a DOMTokenList object.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/classList)

#### Inherited from

HTMLElement.classList

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7604

___

### className

• **className**: `string`

Returns the value of element's class content attribute. Can be set to change it.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/className)

#### Inherited from

HTMLElement.className

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7610

___

### clientHeight

• `Readonly` **clientHeight**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/clientHeight)

#### Inherited from

HTMLElement.clientHeight

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7612

___

### clientLeft

• `Readonly` **clientLeft**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/clientLeft)

#### Inherited from

HTMLElement.clientLeft

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7614

___

### clientTop

• `Readonly` **clientTop**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/clientTop)

#### Inherited from

HTMLElement.clientTop

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7616

___

### clientWidth

• `Readonly` **clientWidth**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/clientWidth)

#### Inherited from

HTMLElement.clientWidth

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7618

___

### contentEditable

• **contentEditable**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/contentEditable)

#### Inherited from

HTMLElement.contentEditable

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7860

___

### dataset

• `Readonly` **dataset**: `DOMStringMap`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/dataset)

#### Inherited from

HTMLElement.dataset

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:12045

___

### dir

• **dir**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/dir)

#### Inherited from

HTMLElement.dir

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:10056

___

### draggable

• **draggable**: `boolean`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/draggable)

#### Inherited from

HTMLElement.draggable

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:10058

___

### enterKeyHint

• **enterKeyHint**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/enterKeyHint)

#### Inherited from

HTMLElement.enterKeyHint

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7862

___

### firstChild

• `Readonly` **firstChild**: `ChildNode`

Returns the first child.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/firstChild)

#### Inherited from

HTMLElement.firstChild

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16084

___

### firstElementChild

• `Readonly` **firstElementChild**: `Element`

Returns the first child that is an element, and null otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Document/firstElementChild)

#### Inherited from

HTMLElement.firstElementChild

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16773

___

### hidden

• **hidden**: `boolean`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/hidden)

#### Inherited from

HTMLElement.hidden

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:10060

___

### id

• **id**: `string`

Returns the value of element's id content attribute. Can be set to change it.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/id)

#### Inherited from

HTMLElement.id

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7624

___

### inert

• **inert**: `boolean`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/inert)

#### Inherited from

HTMLElement.inert

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:10062

___

### innerHTML

• **innerHTML**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/innerHTML)

#### Inherited from

HTMLElement.innerHTML

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:14277

___

### innerText

• **innerText**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/innerText)

#### Inherited from

HTMLElement.innerText

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:10064

___

### inputMode

• **inputMode**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/inputMode)

#### Inherited from

HTMLElement.inputMode

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7864

___

### internals\_

• **internals\_**: `ElementInternals`

#### Defined in

[libs/component/src/types.ts:30](https://github.com/plaited/plaited/blob/65db093/libs/component/src/types.ts#L30)

___

### isConnected

• `Readonly` **isConnected**: `boolean`

Returns true if node is connected and false otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/isConnected)

#### Inherited from

HTMLElement.isConnected

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16090

___

### isContentEditable

• `Readonly` **isContentEditable**: `boolean`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/isContentEditable)

#### Inherited from

HTMLElement.isContentEditable

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7866

___

### lang

• **lang**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/lang)

#### Inherited from

HTMLElement.lang

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:10066

___

### lastChild

• `Readonly` **lastChild**: `ChildNode`

Returns the last child.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/lastChild)

#### Inherited from

HTMLElement.lastChild

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16096

___

### lastElementChild

• `Readonly` **lastElementChild**: `Element`

Returns the last child that is an element, and null otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Document/lastElementChild)

#### Inherited from

HTMLElement.lastElementChild

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16779

___

### localName

• `Readonly` **localName**: `string`

Returns the local name.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/localName)

#### Inherited from

HTMLElement.localName

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7630

___

### namespaceURI

• `Readonly` **namespaceURI**: `string`

Returns the namespace.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/namespaceURI)

#### Inherited from

HTMLElement.namespaceURI

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7636

___

### nextElementSibling

• `Readonly` **nextElementSibling**: `Element`

Returns the first following sibling that is an element, and null otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/CharacterData/nextElementSibling)

#### Inherited from

HTMLElement.nextElementSibling

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16352

___

### nextSibling

• `Readonly` **nextSibling**: `ChildNode`

Returns the next sibling.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/nextSibling)

#### Inherited from

HTMLElement.nextSibling

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16102

___

### nodeName

• `Readonly` **nodeName**: `string`

Returns a string appropriate for the type of node.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/nodeName)

#### Inherited from

HTMLElement.nodeName

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16108

___

### nodeType

• `Readonly` **nodeType**: `number`

Returns the type of node.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/nodeType)

#### Inherited from

HTMLElement.nodeType

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16114

___

### nodeValue

• **nodeValue**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/nodeValue)

#### Inherited from

HTMLElement.nodeValue

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16116

___

### nonce

• `Optional` **nonce**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/nonce)

#### Inherited from

HTMLElement.nonce

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:12047

___

### offsetHeight

• `Readonly` **offsetHeight**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/offsetHeight)

#### Inherited from

HTMLElement.offsetHeight

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:10068

___

### offsetLeft

• `Readonly` **offsetLeft**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/offsetLeft)

#### Inherited from

HTMLElement.offsetLeft

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:10070

___

### offsetParent

• `Readonly` **offsetParent**: `Element`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/offsetParent)

#### Inherited from

HTMLElement.offsetParent

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:10072

___

### offsetTop

• `Readonly` **offsetTop**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/offsetTop)

#### Inherited from

HTMLElement.offsetTop

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:10074

___

### offsetWidth

• `Readonly` **offsetWidth**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/offsetWidth)

#### Inherited from

HTMLElement.offsetWidth

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:10076

___

### onabort

• **onabort**: (`this`: `GlobalEventHandlers`, `ev`: `UIEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Fires when the user aborts the download.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `UIEvent` | The event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/abort_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.onabort

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8946

___

### onanimationcancel

• **onanimationcancel**: (`this`: `GlobalEventHandlers`, `ev`: `AnimationEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/animationcancel_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `AnimationEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.onanimationcancel

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8948

___

### onanimationend

• **onanimationend**: (`this`: `GlobalEventHandlers`, `ev`: `AnimationEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/animationend_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `AnimationEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.onanimationend

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8950

___

### onanimationiteration

• **onanimationiteration**: (`this`: `GlobalEventHandlers`, `ev`: `AnimationEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/animationiteration_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `AnimationEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.onanimationiteration

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8952

___

### onanimationstart

• **onanimationstart**: (`this`: `GlobalEventHandlers`, `ev`: `AnimationEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/animationstart_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `AnimationEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.onanimationstart

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8954

___

### onauxclick

• **onauxclick**: (`this`: `GlobalEventHandlers`, `ev`: `MouseEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/auxclick_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `MouseEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.onauxclick

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8956

___

### onbeforeinput

• **onbeforeinput**: (`this`: `GlobalEventHandlers`, `ev`: `InputEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/beforeinput_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `InputEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.onbeforeinput

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8958

___

### onblur

• **onblur**: (`this`: `GlobalEventHandlers`, `ev`: `FocusEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Fires when the object loses the input focus.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `FocusEvent` | The focus event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/blur_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.onblur

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8965

___

### oncancel

• **oncancel**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLDialogElement/cancel_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `Event` |

##### Returns

`any`

#### Inherited from

HTMLElement.oncancel

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8967

___

### oncanplay

• **oncanplay**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Occurs when playback is possible, but would require further buffering.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `Event` | The event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/canplay_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.oncanplay

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8974

___

### oncanplaythrough

• **oncanplaythrough**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/canplaythrough_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `Event` |

##### Returns

`any`

#### Inherited from

HTMLElement.oncanplaythrough

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8976

___

### onchange

• **onchange**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Fires when the contents of the object or selection have changed.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `Event` | The event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/change_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.onchange

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8983

___

### onclick

• **onclick**: (`this`: `GlobalEventHandlers`, `ev`: `MouseEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Fires when the user clicks the left mouse button on the object

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `MouseEvent` | The mouse event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/click_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.onclick

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8990

___

### onclose

• **onclose**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLDialogElement/close_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `Event` |

##### Returns

`any`

#### Inherited from

HTMLElement.onclose

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8992

___

### oncontextmenu

• **oncontextmenu**: (`this`: `GlobalEventHandlers`, `ev`: `MouseEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Fires when the user clicks the right mouse button in the client area, opening the context menu.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `MouseEvent` | The mouse event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/contextmenu_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.oncontextmenu

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8999

___

### oncopy

• **oncopy**: (`this`: `GlobalEventHandlers`, `ev`: `ClipboardEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/copy_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `ClipboardEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.oncopy

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9001

___

### oncuechange

• **oncuechange**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLTrackElement/cuechange_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `Event` |

##### Returns

`any`

#### Inherited from

HTMLElement.oncuechange

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9003

___

### oncut

• **oncut**: (`this`: `GlobalEventHandlers`, `ev`: `ClipboardEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/cut_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `ClipboardEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.oncut

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9005

___

### ondblclick

• **ondblclick**: (`this`: `GlobalEventHandlers`, `ev`: `MouseEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Fires when the user double-clicks the object.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `MouseEvent` | The mouse event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/dblclick_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.ondblclick

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9012

___

### ondrag

• **ondrag**: (`this`: `GlobalEventHandlers`, `ev`: `DragEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Fires on the source object continuously during a drag operation.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `DragEvent` | The event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/drag_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.ondrag

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9019

___

### ondragend

• **ondragend**: (`this`: `GlobalEventHandlers`, `ev`: `DragEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Fires on the source object when the user releases the mouse at the close of a drag operation.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `DragEvent` | The event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/dragend_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.ondragend

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9026

___

### ondragenter

• **ondragenter**: (`this`: `GlobalEventHandlers`, `ev`: `DragEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Fires on the target element when the user drags the object to a valid drop target.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `DragEvent` | The drag event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/dragenter_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.ondragenter

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9033

___

### ondragleave

• **ondragleave**: (`this`: `GlobalEventHandlers`, `ev`: `DragEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Fires on the target object when the user moves the mouse out of a valid drop target during a drag operation.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `DragEvent` | The drag event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/dragleave_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.ondragleave

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9040

___

### ondragover

• **ondragover**: (`this`: `GlobalEventHandlers`, `ev`: `DragEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Fires on the target element continuously while the user drags the object over a valid drop target.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `DragEvent` | The event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/dragover_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.ondragover

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9047

___

### ondragstart

• **ondragstart**: (`this`: `GlobalEventHandlers`, `ev`: `DragEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Fires on the source object when the user starts to drag a text selection or selected object.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `DragEvent` | The event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/dragstart_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.ondragstart

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9054

___

### ondrop

• **ondrop**: (`this`: `GlobalEventHandlers`, `ev`: `DragEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/drop_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `DragEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.ondrop

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9056

___

### ondurationchange

• **ondurationchange**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Occurs when the duration attribute is updated.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `Event` | The event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/durationchange_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.ondurationchange

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9063

___

### onemptied

• **onemptied**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Occurs when the media element is reset to its initial state.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `Event` | The event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/emptied_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.onemptied

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9070

___

### onended

• **onended**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Occurs when the end of playback is reached.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `Event` | The event [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/ended_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.onended

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9077

___

### onerror

• **onerror**: `OnErrorEventHandlerNonNull`

Fires when an error occurs during object loading.

**`Param`**

The event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/error_event)

#### Inherited from

HTMLElement.onerror

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9084

___

### onfocus

• **onfocus**: (`this`: `GlobalEventHandlers`, `ev`: `FocusEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Fires when the object receives focus.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `FocusEvent` | The event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/focus_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.onfocus

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9091

___

### onformdata

• **onformdata**: (`this`: `GlobalEventHandlers`, `ev`: `FormDataEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLFormElement/formdata_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `FormDataEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.onformdata

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9093

___

### onfullscreenchange

• **onfullscreenchange**: (`this`: `Element`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/fullscreenchange_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `Element` |
| `ev` | `Event` |

##### Returns

`any`

#### Inherited from

HTMLElement.onfullscreenchange

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7638

___

### onfullscreenerror

• **onfullscreenerror**: (`this`: `Element`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/fullscreenerror_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `Element` |
| `ev` | `Event` |

##### Returns

`any`

#### Inherited from

HTMLElement.onfullscreenerror

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7640

___

### ongotpointercapture

• **ongotpointercapture**: (`this`: `GlobalEventHandlers`, `ev`: `PointerEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/gotpointercapture_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `PointerEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.ongotpointercapture

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9095

___

### oninput

• **oninput**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/input_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `Event` |

##### Returns

`any`

#### Inherited from

HTMLElement.oninput

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9097

___

### oninvalid

• **oninvalid**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLInputElement/invalid_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `Event` |

##### Returns

`any`

#### Inherited from

HTMLElement.oninvalid

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9099

___

### onkeydown

• **onkeydown**: (`this`: `GlobalEventHandlers`, `ev`: `KeyboardEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Fires when the user presses a key.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `KeyboardEvent` | The keyboard event [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/keydown_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.onkeydown

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9106

___

### onkeypress

• **onkeypress**: (`this`: `GlobalEventHandlers`, `ev`: `KeyboardEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Fires when the user presses an alphanumeric key.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `KeyboardEvent` | The event. |

##### Returns

`any`

**`Deprecated`**

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/keypress_event)

#### Inherited from

HTMLElement.onkeypress

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9114

___

### onkeyup

• **onkeyup**: (`this`: `GlobalEventHandlers`, `ev`: `KeyboardEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Fires when the user releases a key.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `KeyboardEvent` | The keyboard event [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/keyup_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.onkeyup

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9121

___

### onload

• **onload**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Fires immediately after the browser loads the object.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `Event` | The event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/SVGElement/load_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.onload

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9128

___

### onloadeddata

• **onloadeddata**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Occurs when media data is loaded at the current playback position.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `Event` | The event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/loadeddata_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.onloadeddata

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9135

___

### onloadedmetadata

• **onloadedmetadata**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Occurs when the duration and dimensions of the media have been determined.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `Event` | The event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/loadedmetadata_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.onloadedmetadata

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9142

___

### onloadstart

• **onloadstart**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Occurs when Internet Explorer begins looking for media data.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `Event` | The event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/loadstart_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.onloadstart

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9149

___

### onlostpointercapture

• **onlostpointercapture**: (`this`: `GlobalEventHandlers`, `ev`: `PointerEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Document/lostpointercapture_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `PointerEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.onlostpointercapture

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9151

___

### onmousedown

• **onmousedown**: (`this`: `GlobalEventHandlers`, `ev`: `MouseEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Fires when the user clicks the object with either mouse button.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `MouseEvent` | The mouse event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/mousedown_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.onmousedown

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9158

___

### onmouseenter

• **onmouseenter**: (`this`: `GlobalEventHandlers`, `ev`: `MouseEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/mouseenter_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `MouseEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.onmouseenter

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9160

___

### onmouseleave

• **onmouseleave**: (`this`: `GlobalEventHandlers`, `ev`: `MouseEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/mouseleave_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `MouseEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.onmouseleave

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9162

___

### onmousemove

• **onmousemove**: (`this`: `GlobalEventHandlers`, `ev`: `MouseEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Fires when the user moves the mouse over the object.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `MouseEvent` | The mouse event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/mousemove_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.onmousemove

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9169

___

### onmouseout

• **onmouseout**: (`this`: `GlobalEventHandlers`, `ev`: `MouseEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Fires when the user moves the mouse pointer outside the boundaries of the object.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `MouseEvent` | The mouse event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/mouseout_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.onmouseout

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9176

___

### onmouseover

• **onmouseover**: (`this`: `GlobalEventHandlers`, `ev`: `MouseEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Fires when the user moves the mouse pointer into the object.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `MouseEvent` | The mouse event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/mouseover_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.onmouseover

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9183

___

### onmouseup

• **onmouseup**: (`this`: `GlobalEventHandlers`, `ev`: `MouseEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Fires when the user releases a mouse button while the mouse is over the object.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `MouseEvent` | The mouse event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/mouseup_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.onmouseup

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9190

___

### onpaste

• **onpaste**: (`this`: `GlobalEventHandlers`, `ev`: `ClipboardEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/paste_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `ClipboardEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.onpaste

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9192

___

### onpause

• **onpause**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Occurs when playback is paused.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `Event` | The event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/pause_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.onpause

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9199

___

### onplay

• **onplay**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Occurs when the play method is requested.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `Event` | The event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/play_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.onplay

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9206

___

### onplaying

• **onplaying**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Occurs when the audio or video has started playing.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `Event` | The event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/playing_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.onplaying

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9213

___

### onpointercancel

• **onpointercancel**: (`this`: `GlobalEventHandlers`, `ev`: `PointerEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/pointercancel_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `PointerEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.onpointercancel

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9215

___

### onpointerdown

• **onpointerdown**: (`this`: `GlobalEventHandlers`, `ev`: `PointerEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/pointerdown_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `PointerEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.onpointerdown

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9217

___

### onpointerenter

• **onpointerenter**: (`this`: `GlobalEventHandlers`, `ev`: `PointerEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/pointerenter_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `PointerEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.onpointerenter

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9219

___

### onpointerleave

• **onpointerleave**: (`this`: `GlobalEventHandlers`, `ev`: `PointerEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/pointerleave_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `PointerEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.onpointerleave

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9221

___

### onpointermove

• **onpointermove**: (`this`: `GlobalEventHandlers`, `ev`: `PointerEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/pointermove_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `PointerEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.onpointermove

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9223

___

### onpointerout

• **onpointerout**: (`this`: `GlobalEventHandlers`, `ev`: `PointerEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/pointerout_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `PointerEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.onpointerout

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9225

___

### onpointerover

• **onpointerover**: (`this`: `GlobalEventHandlers`, `ev`: `PointerEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/pointerover_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `PointerEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.onpointerover

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9227

___

### onpointerup

• **onpointerup**: (`this`: `GlobalEventHandlers`, `ev`: `PointerEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/pointerup_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `PointerEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.onpointerup

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9229

___

### onprogress

• **onprogress**: (`this`: `GlobalEventHandlers`, `ev`: `ProgressEvent`<`EventTarget`\>) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Occurs to indicate progress while downloading media data.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `ProgressEvent`<`EventTarget`\> | The event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/progress_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.onprogress

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9236

___

### onratechange

• **onratechange**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Occurs when the playback rate is increased or decreased.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `Event` | The event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/ratechange_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.onratechange

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9243

___

### onreset

• **onreset**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Fires when the user resets a form.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `Event` | The event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLFormElement/reset_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.onreset

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9250

___

### onresize

• **onresize**: (`this`: `GlobalEventHandlers`, `ev`: `UIEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLVideoElement/resize_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `UIEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.onresize

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9252

___

### onscroll

• **onscroll**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Fires when the user repositions the scroll box in the scroll bar on the object.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `Event` | The event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/Document/scroll_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.onscroll

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9259

___

### onscrollend

• **onscrollend**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Document/scrollend_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `Event` |

##### Returns

`any`

#### Inherited from

HTMLElement.onscrollend

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9261

___

### onsecuritypolicyviolation

• **onsecuritypolicyviolation**: (`this`: `GlobalEventHandlers`, `ev`: `SecurityPolicyViolationEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Document/securitypolicyviolation_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `SecurityPolicyViolationEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.onsecuritypolicyviolation

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9263

___

### onseeked

• **onseeked**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Occurs when the seek operation ends.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `Event` | The event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/seeked_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.onseeked

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9270

___

### onseeking

• **onseeking**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Occurs when the current playback position is moved.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `Event` | The event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/seeking_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.onseeking

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9277

___

### onselect

• **onselect**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Fires when the current selection changes.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `Event` | The event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLInputElement/select_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.onselect

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9284

___

### onselectionchange

• **onselectionchange**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Document/selectionchange_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `Event` |

##### Returns

`any`

#### Inherited from

HTMLElement.onselectionchange

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9286

___

### onselectstart

• **onselectstart**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/selectstart_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `Event` |

##### Returns

`any`

#### Inherited from

HTMLElement.onselectstart

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9288

___

### onslotchange

• **onslotchange**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLSlotElement/slotchange_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `Event` |

##### Returns

`any`

#### Inherited from

HTMLElement.onslotchange

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9290

___

### onstalled

• **onstalled**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Occurs when the download has stopped.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `Event` | The event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/stalled_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.onstalled

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9297

___

### onsubmit

• **onsubmit**: (`this`: `GlobalEventHandlers`, `ev`: `SubmitEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLFormElement/submit_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `SubmitEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.onsubmit

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9299

___

### onsuspend

• **onsuspend**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Occurs if the load operation has been intentionally halted.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `Event` | The event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/suspend_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.onsuspend

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9306

___

### ontimeupdate

• **ontimeupdate**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Occurs to indicate the current playback position.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `Event` | The event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/timeupdate_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.ontimeupdate

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9313

___

### ontoggle

• **ontoggle**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLDetailsElement/toggle_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `Event` |

##### Returns

`any`

#### Inherited from

HTMLElement.ontoggle

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9315

___

### ontouchcancel

• `Optional` **ontouchcancel**: (`this`: `GlobalEventHandlers`, `ev`: `TouchEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/touchcancel_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `TouchEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.ontouchcancel

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9317

___

### ontouchend

• `Optional` **ontouchend**: (`this`: `GlobalEventHandlers`, `ev`: `TouchEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/touchend_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `TouchEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.ontouchend

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9319

___

### ontouchmove

• `Optional` **ontouchmove**: (`this`: `GlobalEventHandlers`, `ev`: `TouchEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/touchmove_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `TouchEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.ontouchmove

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9321

___

### ontouchstart

• `Optional` **ontouchstart**: (`this`: `GlobalEventHandlers`, `ev`: `TouchEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/touchstart_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `TouchEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.ontouchstart

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9323

___

### ontransitioncancel

• **ontransitioncancel**: (`this`: `GlobalEventHandlers`, `ev`: `TransitionEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/transitioncancel_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `TransitionEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.ontransitioncancel

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9325

___

### ontransitionend

• **ontransitionend**: (`this`: `GlobalEventHandlers`, `ev`: `TransitionEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/transitionend_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `TransitionEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.ontransitionend

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9327

___

### ontransitionrun

• **ontransitionrun**: (`this`: `GlobalEventHandlers`, `ev`: `TransitionEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/transitionrun_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `TransitionEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.ontransitionrun

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9329

___

### ontransitionstart

• **ontransitionstart**: (`this`: `GlobalEventHandlers`, `ev`: `TransitionEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/transitionstart_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `TransitionEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.ontransitionstart

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9331

___

### onvolumechange

• **onvolumechange**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Occurs when the volume is changed, or playback is muted or unmuted.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `Event` | The event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/volumechange_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.onvolumechange

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9338

___

### onwaiting

• **onwaiting**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

Occurs when playback stops because the next frame of a video resource is not available.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `this` | `GlobalEventHandlers` | - |
| `ev` | `Event` | The event. [MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/waiting_event) |

##### Returns

`any`

#### Inherited from

HTMLElement.onwaiting

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9345

___

### onwebkitanimationend

• **onwebkitanimationend**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `Event` |

##### Returns

`any`

**`Deprecated`**

This is a legacy alias of `onanimationend`.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/animationend_event)

#### Inherited from

HTMLElement.onwebkitanimationend

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9351

___

### onwebkitanimationiteration

• **onwebkitanimationiteration**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `Event` |

##### Returns

`any`

**`Deprecated`**

This is a legacy alias of `onanimationiteration`.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/animationiteration_event)

#### Inherited from

HTMLElement.onwebkitanimationiteration

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9357

___

### onwebkitanimationstart

• **onwebkitanimationstart**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `Event` |

##### Returns

`any`

**`Deprecated`**

This is a legacy alias of `onanimationstart`.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/animationstart_event)

#### Inherited from

HTMLElement.onwebkitanimationstart

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9363

___

### onwebkittransitionend

• **onwebkittransitionend**: (`this`: `GlobalEventHandlers`, `ev`: `Event`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `Event` |

##### Returns

`any`

**`Deprecated`**

This is a legacy alias of `ontransitionend`.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/transitionend_event)

#### Inherited from

HTMLElement.onwebkittransitionend

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9369

___

### onwheel

• **onwheel**: (`this`: `GlobalEventHandlers`, `ev`: `WheelEvent`) => `any`

#### Type declaration

▸ (`this`, `ev`): `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/wheel_event)

##### Parameters

| Name | Type |
| :------ | :------ |
| `this` | `GlobalEventHandlers` |
| `ev` | `WheelEvent` |

##### Returns

`any`

#### Inherited from

HTMLElement.onwheel

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:9371

___

### outerHTML

• **outerHTML**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/outerHTML)

#### Inherited from

HTMLElement.outerHTML

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7642

___

### outerText

• **outerText**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/outerText)

#### Inherited from

HTMLElement.outerText

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:10078

___

### ownerDocument

• `Readonly` **ownerDocument**: `Document`

#### Inherited from

HTMLElement.ownerDocument

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7643

___

### parentElement

• `Readonly` **parentElement**: `HTMLElement`

Returns the parent element.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/parentElement)

#### Inherited from

HTMLElement.parentElement

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16128

___

### parentNode

• `Readonly` **parentNode**: `ParentNode`

Returns the parent.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/parentNode)

#### Inherited from

HTMLElement.parentNode

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16134

___

### part

• `Readonly` **part**: `DOMTokenList`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/part)

#### Inherited from

HTMLElement.part

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7645

___

### popover

• **popover**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/popover)

#### Inherited from

HTMLElement.popover

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:10080

___

### prefix

• `Readonly` **prefix**: `string`

Returns the namespace prefix.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/prefix)

#### Inherited from

HTMLElement.prefix

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7651

___

### previousElementSibling

• `Readonly` **previousElementSibling**: `Element`

Returns the first preceding sibling that is an element, and null otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/CharacterData/previousElementSibling)

#### Inherited from

HTMLElement.previousElementSibling

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16358

___

### previousSibling

• `Readonly` **previousSibling**: `ChildNode`

Returns the previous sibling.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/previousSibling)

#### Inherited from

HTMLElement.previousSibling

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16140

___

### role

• **role**: `string`

#### Inherited from

HTMLElement.role

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2279

___

### scrollHeight

• `Readonly` **scrollHeight**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/scrollHeight)

#### Inherited from

HTMLElement.scrollHeight

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7653

___

### scrollLeft

• **scrollLeft**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/scrollLeft)

#### Inherited from

HTMLElement.scrollLeft

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7655

___

### scrollTop

• **scrollTop**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/scrollTop)

#### Inherited from

HTMLElement.scrollTop

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7657

___

### scrollWidth

• `Readonly` **scrollWidth**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/scrollWidth)

#### Inherited from

HTMLElement.scrollWidth

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7659

___

### shadowRoot

• `Readonly` **shadowRoot**: `ShadowRoot`

Returns element's shadow root, if any, and if shadow root's mode is "open", and null otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/shadowRoot)

#### Inherited from

HTMLElement.shadowRoot

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7665

___

### slot

• **slot**: `string`

Returns the value of element's slot content attribute. Can be set to change it.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/slot)

#### Inherited from

HTMLElement.slot

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7671

___

### spellcheck

• **spellcheck**: `boolean`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/spellcheck)

#### Inherited from

HTMLElement.spellcheck

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:10082

___

### style

• `Readonly` **style**: `CSSStyleDeclaration`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/style)

#### Inherited from

HTMLElement.style

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7855

___

### tabIndex

• **tabIndex**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/tabIndex)

#### Inherited from

HTMLElement.tabIndex

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:12049

___

### tagName

• `Readonly` **tagName**: `string`

Returns the HTML-uppercased qualified name.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/tagName)

#### Inherited from

HTMLElement.tagName

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7677

___

### textContent

• **textContent**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/textContent)

#### Inherited from

HTMLElement.textContent

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16142

___

### title

• **title**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/title)

#### Inherited from

HTMLElement.title

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:10084

___

### translate

• **translate**: `boolean`

#### Inherited from

HTMLElement.translate

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:10085

## Methods

### addEventListener

▸ **addEventListener**<`K`\>(`type`, `listener`, `options?`): `void`

#### Type parameters

| Name | Type |
| :------ | :------ |
| `K` | extends keyof `HTMLElementEventMap` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `type` | `K` |
| `listener` | (`this`: `HTMLElement`, `ev`: `HTMLElementEventMap`[`K`]) => `any` |
| `options?` | `boolean` \| `AddEventListenerOptions` |

#### Returns

`void`

#### Inherited from

HTMLElement.addEventListener

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:10096

▸ **addEventListener**(`type`, `listener`, `options?`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `type` | `string` |
| `listener` | `EventListenerOrEventListenerObject` |
| `options?` | `boolean` \| `AddEventListenerOptions` |

#### Returns

`void`

#### Inherited from

HTMLElement.addEventListener

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:10097

___

### adoptedCallback

▸ `Optional` **adoptedCallback**(): `void`

#### Returns

`void`

#### Defined in

[libs/component/src/types.ts:39](https://github.com/plaited/plaited/blob/65db093/libs/component/src/types.ts#L39)

___

### after

▸ **after**(`...nodes`): `void`

Inserts nodes just after node, while replacing strings in nodes with equivalent Text nodes.

Throws a "HierarchyRequestError" DOMException if the constraints of the node tree are violated.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/CharacterData/after)

#### Parameters

| Name | Type |
| :------ | :------ |
| `...nodes` | (`string` \| `Node`)[] |

#### Returns

`void`

#### Inherited from

HTMLElement.after

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:5597

___

### animate

▸ **animate**(`keyframes`, `options?`): `Animation`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/animate)

#### Parameters

| Name | Type |
| :------ | :------ |
| `keyframes` | `PropertyIndexedKeyframes` \| `Keyframe`[] |
| `options?` | `number` \| `KeyframeAnimationOptions` |

#### Returns

`Animation`

#### Inherited from

HTMLElement.animate

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2429

___

### append

▸ **append**(`...nodes`): `void`

Inserts nodes after the last child of node, while replacing strings in nodes with equivalent Text nodes.

Throws a "HierarchyRequestError" DOMException if the constraints of the node tree are violated.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Document/append)

#### Parameters

| Name | Type |
| :------ | :------ |
| `...nodes` | (`string` \| `Node`)[] |

#### Returns

`void`

#### Inherited from

HTMLElement.append

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16787

___

### appendChild

▸ **appendChild**<`T`\>(`node`): `T`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/appendChild)

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `Node` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `node` | `T` |

#### Returns

`T`

#### Inherited from

HTMLElement.appendChild

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16144

___

### attachInternals

▸ **attachInternals**(): `ElementInternals`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/attachInternals)

#### Returns

`ElementInternals`

#### Inherited from

HTMLElement.attachInternals

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:10087

___

### attachShadow

▸ **attachShadow**(`init`): `ShadowRoot`

Creates a shadow root for element and returns it.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/attachShadow)

#### Parameters

| Name | Type |
| :------ | :------ |
| `init` | `ShadowRootInit` |

#### Returns

`ShadowRoot`

#### Inherited from

HTMLElement.attachShadow

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7683

___

### attributeChangedCallback

▸ `Optional` **attributeChangedCallback**(`name`, `oldValue`, `newValue`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `oldValue` | `string` |
| `newValue` | `string` |

#### Returns

`void`

#### Defined in

[libs/component/src/types.ts:33](https://github.com/plaited/plaited/blob/65db093/libs/component/src/types.ts#L33)

___

### before

▸ **before**(`...nodes`): `void`

Inserts nodes just before node, while replacing strings in nodes with equivalent Text nodes.

Throws a "HierarchyRequestError" DOMException if the constraints of the node tree are violated.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/CharacterData/before)

#### Parameters

| Name | Type |
| :------ | :------ |
| `...nodes` | (`string` \| `Node`)[] |

#### Returns

`void`

#### Inherited from

HTMLElement.before

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:5605

___

### blur

▸ **blur**(): `void`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/blur)

#### Returns

`void`

#### Inherited from

HTMLElement.blur

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:12051

___

### checkVisibility

▸ **checkVisibility**(`options?`): `boolean`

#### Parameters

| Name | Type |
| :------ | :------ |
| `options?` | `CheckVisibilityOptions` |

#### Returns

`boolean`

#### Inherited from

HTMLElement.checkVisibility

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7684

___

### click

▸ **click**(): `void`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/click)

#### Returns

`void`

#### Inherited from

HTMLElement.click

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:10089

___

### cloneNode

▸ **cloneNode**(`deep?`): `Node`

Returns a copy of node. If deep is true, the copy also includes the node's descendants.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/cloneNode)

#### Parameters

| Name | Type |
| :------ | :------ |
| `deep?` | `boolean` |

#### Returns

`Node`

#### Inherited from

HTMLElement.cloneNode

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16150

___

### closest

▸ **closest**<`K`\>(`selector`): `HTMLElementTagNameMap`[`K`]

Returns the first (starting at element) inclusive ancestor that matches selectors, and null otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/closest)

#### Type parameters

| Name | Type |
| :------ | :------ |
| `K` | extends keyof `HTMLElementTagNameMap` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `selector` | `K` |

#### Returns

`HTMLElementTagNameMap`[`K`]

#### Inherited from

HTMLElement.closest

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7690

▸ **closest**<`K`\>(`selector`): `SVGElementTagNameMap`[`K`]

#### Type parameters

| Name | Type |
| :------ | :------ |
| `K` | extends keyof `SVGElementTagNameMap` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `selector` | `K` |

#### Returns

`SVGElementTagNameMap`[`K`]

#### Inherited from

HTMLElement.closest

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7691

▸ **closest**<`K`\>(`selector`): `MathMLElementTagNameMap`[`K`]

#### Type parameters

| Name | Type |
| :------ | :------ |
| `K` | extends keyof `MathMLElementTagNameMap` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `selector` | `K` |

#### Returns

`MathMLElementTagNameMap`[`K`]

#### Inherited from

HTMLElement.closest

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7692

▸ **closest**<`E`\>(`selectors`): `E`

#### Type parameters

| Name | Type |
| :------ | :------ |
| `E` | extends `Element` = `Element` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `selectors` | `string` |

#### Returns

`E`

#### Inherited from

HTMLElement.closest

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7693

___

### compareDocumentPosition

▸ **compareDocumentPosition**(`other`): `number`

Returns a bitmask indicating the position of other relative to node.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/compareDocumentPosition)

#### Parameters

| Name | Type |
| :------ | :------ |
| `other` | `Node` |

#### Returns

`number`

#### Inherited from

HTMLElement.compareDocumentPosition

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16156

___

### computedStyleMap

▸ **computedStyleMap**(): `StylePropertyMapReadOnly`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/computedStyleMap)

#### Returns

`StylePropertyMapReadOnly`

#### Inherited from

HTMLElement.computedStyleMap

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7695

___

### connectedCallback

▸ `Optional` **connectedCallback**(): `void`

#### Returns

`void`

#### Defined in

[libs/component/src/types.ts:32](https://github.com/plaited/plaited/blob/65db093/libs/component/src/types.ts#L32)

___

### contains

▸ **contains**(`other`): `boolean`

Returns true if other is an inclusive descendant of node, and false otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/contains)

#### Parameters

| Name | Type |
| :------ | :------ |
| `other` | `Node` |

#### Returns

`boolean`

#### Inherited from

HTMLElement.contains

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16162

___

### disconnectedCallback

▸ `Optional` **disconnectedCallback**(): `void`

#### Returns

`void`

#### Defined in

[libs/component/src/types.ts:38](https://github.com/plaited/plaited/blob/65db093/libs/component/src/types.ts#L38)

___

### dispatchEvent

▸ **dispatchEvent**(`event`): `boolean`

Dispatches a synthetic event event to target and returns true if either event's cancelable attribute value is false or its preventDefault() method was not invoked, and false otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/EventTarget/dispatchEvent)

#### Parameters

| Name | Type |
| :------ | :------ |
| `event` | `Event` |

#### Returns

`boolean`

#### Inherited from

HTMLElement.dispatchEvent

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:8215

___

### focus

▸ **focus**(`options?`): `void`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/focus)

#### Parameters

| Name | Type |
| :------ | :------ |
| `options?` | `FocusOptions` |

#### Returns

`void`

#### Inherited from

HTMLElement.focus

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:12053

___

### formAssociatedCallback

▸ `Optional` **formAssociatedCallback**(`form`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `form` | `HTMLFormElement` |

#### Returns

`void`

#### Defined in

[libs/component/src/types.ts:40](https://github.com/plaited/plaited/blob/65db093/libs/component/src/types.ts#L40)

___

### formDisabledCallback

▸ `Optional` **formDisabledCallback**(`disabled`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `disabled` | `boolean` |

#### Returns

`void`

#### Defined in

[libs/component/src/types.ts:41](https://github.com/plaited/plaited/blob/65db093/libs/component/src/types.ts#L41)

___

### formResetCallback

▸ `Optional` **formResetCallback**(): `void`

#### Returns

`void`

#### Defined in

[libs/component/src/types.ts:42](https://github.com/plaited/plaited/blob/65db093/libs/component/src/types.ts#L42)

___

### formStateRestoreCallback

▸ `Optional` **formStateRestoreCallback**(`state`, `reason`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `state` | `unknown` |
| `reason` | ``"autocomplete"`` \| ``"restore"`` |

#### Returns

`void`

#### Defined in

[libs/component/src/types.ts:43](https://github.com/plaited/plaited/blob/65db093/libs/component/src/types.ts#L43)

___

### getAnimations

▸ **getAnimations**(`options?`): `Animation`[]

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/getAnimations)

#### Parameters

| Name | Type |
| :------ | :------ |
| `options?` | `GetAnimationsOptions` |

#### Returns

`Animation`[]

#### Inherited from

HTMLElement.getAnimations

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:2431

___

### getAttribute

▸ **getAttribute**(`qualifiedName`): `string`

Returns element's first attribute whose qualified name is qualifiedName, and null if there is no such attribute otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/getAttribute)

#### Parameters

| Name | Type |
| :------ | :------ |
| `qualifiedName` | `string` |

#### Returns

`string`

#### Inherited from

HTMLElement.getAttribute

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7701

___

### getAttributeNS

▸ **getAttributeNS**(`namespace`, `localName`): `string`

Returns element's attribute whose namespace is namespace and local name is localName, and null if there is no such attribute otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/getAttributeNS)

#### Parameters

| Name | Type |
| :------ | :------ |
| `namespace` | `string` |
| `localName` | `string` |

#### Returns

`string`

#### Inherited from

HTMLElement.getAttributeNS

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7707

___

### getAttributeNames

▸ **getAttributeNames**(): `string`[]

Returns the qualified names of all element's attributes. Can contain duplicates.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/getAttributeNames)

#### Returns

`string`[]

#### Inherited from

HTMLElement.getAttributeNames

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7713

___

### getAttributeNode

▸ **getAttributeNode**(`qualifiedName`): `Attr`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/getAttributeNode)

#### Parameters

| Name | Type |
| :------ | :------ |
| `qualifiedName` | `string` |

#### Returns

`Attr`

#### Inherited from

HTMLElement.getAttributeNode

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7715

___

### getAttributeNodeNS

▸ **getAttributeNodeNS**(`namespace`, `localName`): `Attr`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/getAttributeNodeNS)

#### Parameters

| Name | Type |
| :------ | :------ |
| `namespace` | `string` |
| `localName` | `string` |

#### Returns

`Attr`

#### Inherited from

HTMLElement.getAttributeNodeNS

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7717

___

### getBoundingClientRect

▸ **getBoundingClientRect**(): `DOMRect`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/getBoundingClientRect)

#### Returns

`DOMRect`

#### Inherited from

HTMLElement.getBoundingClientRect

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7719

___

### getClientRects

▸ **getClientRects**(): `DOMRectList`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/getClientRects)

#### Returns

`DOMRectList`

#### Inherited from

HTMLElement.getClientRects

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7721

___

### getElementsByClassName

▸ **getElementsByClassName**(`classNames`): `HTMLCollectionOf`<`Element`\>

Returns a HTMLCollection of the elements in the object on which the method was invoked (a document or an element) that have all the classes given by classNames. The classNames argument is interpreted as a space-separated list of classes.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/getElementsByClassName)

#### Parameters

| Name | Type |
| :------ | :------ |
| `classNames` | `string` |

#### Returns

`HTMLCollectionOf`<`Element`\>

#### Inherited from

HTMLElement.getElementsByClassName

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7727

___

### getElementsByTagName

▸ **getElementsByTagName**<`K`\>(`qualifiedName`): `HTMLCollectionOf`<`HTMLElementTagNameMap`[`K`]\>

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/getElementsByTagName)

#### Type parameters

| Name | Type |
| :------ | :------ |
| `K` | extends keyof `HTMLElementTagNameMap` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `qualifiedName` | `K` |

#### Returns

`HTMLCollectionOf`<`HTMLElementTagNameMap`[`K`]\>

#### Inherited from

HTMLElement.getElementsByTagName

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7729

▸ **getElementsByTagName**<`K`\>(`qualifiedName`): `HTMLCollectionOf`<`SVGElementTagNameMap`[`K`]\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `K` | extends keyof `SVGElementTagNameMap` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `qualifiedName` | `K` |

#### Returns

`HTMLCollectionOf`<`SVGElementTagNameMap`[`K`]\>

#### Inherited from

HTMLElement.getElementsByTagName

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7730

▸ **getElementsByTagName**<`K`\>(`qualifiedName`): `HTMLCollectionOf`<`MathMLElementTagNameMap`[`K`]\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `K` | extends keyof `MathMLElementTagNameMap` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `qualifiedName` | `K` |

#### Returns

`HTMLCollectionOf`<`MathMLElementTagNameMap`[`K`]\>

#### Inherited from

HTMLElement.getElementsByTagName

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7731

▸ **getElementsByTagName**<`K`\>(`qualifiedName`): `HTMLCollectionOf`<`HTMLElementDeprecatedTagNameMap`[`K`]\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `K` | extends keyof `HTMLElementDeprecatedTagNameMap` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `qualifiedName` | `K` |

#### Returns

`HTMLCollectionOf`<`HTMLElementDeprecatedTagNameMap`[`K`]\>

**`Deprecated`**

#### Inherited from

HTMLElement.getElementsByTagName

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7733

▸ **getElementsByTagName**(`qualifiedName`): `HTMLCollectionOf`<`Element`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `qualifiedName` | `string` |

#### Returns

`HTMLCollectionOf`<`Element`\>

#### Inherited from

HTMLElement.getElementsByTagName

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7734

___

### getElementsByTagNameNS

▸ **getElementsByTagNameNS**(`namespaceURI`, `localName`): `HTMLCollectionOf`<`HTMLElement`\>

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/getElementsByTagNameNS)

#### Parameters

| Name | Type |
| :------ | :------ |
| `namespaceURI` | ``"http://www.w3.org/1999/xhtml"`` |
| `localName` | `string` |

#### Returns

`HTMLCollectionOf`<`HTMLElement`\>

#### Inherited from

HTMLElement.getElementsByTagNameNS

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7736

▸ **getElementsByTagNameNS**(`namespaceURI`, `localName`): `HTMLCollectionOf`<`SVGElement`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `namespaceURI` | ``"http://www.w3.org/2000/svg"`` |
| `localName` | `string` |

#### Returns

`HTMLCollectionOf`<`SVGElement`\>

#### Inherited from

HTMLElement.getElementsByTagNameNS

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7737

▸ **getElementsByTagNameNS**(`namespaceURI`, `localName`): `HTMLCollectionOf`<`MathMLElement`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `namespaceURI` | ``"http://www.w3.org/1998/Math/MathML"`` |
| `localName` | `string` |

#### Returns

`HTMLCollectionOf`<`MathMLElement`\>

#### Inherited from

HTMLElement.getElementsByTagNameNS

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7738

▸ **getElementsByTagNameNS**(`namespace`, `localName`): `HTMLCollectionOf`<`Element`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `namespace` | `string` |
| `localName` | `string` |

#### Returns

`HTMLCollectionOf`<`Element`\>

#### Inherited from

HTMLElement.getElementsByTagNameNS

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7739

___

### getRootNode

▸ **getRootNode**(`options?`): `Node`

Returns node's root.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/getRootNode)

#### Parameters

| Name | Type |
| :------ | :------ |
| `options?` | `GetRootNodeOptions` |

#### Returns

`Node`

#### Inherited from

HTMLElement.getRootNode

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16168

___

### hasAttribute

▸ **hasAttribute**(`qualifiedName`): `boolean`

Returns true if element has an attribute whose qualified name is qualifiedName, and false otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/hasAttribute)

#### Parameters

| Name | Type |
| :------ | :------ |
| `qualifiedName` | `string` |

#### Returns

`boolean`

#### Inherited from

HTMLElement.hasAttribute

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7745

___

### hasAttributeNS

▸ **hasAttributeNS**(`namespace`, `localName`): `boolean`

Returns true if element has an attribute whose namespace is namespace and local name is localName.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/hasAttributeNS)

#### Parameters

| Name | Type |
| :------ | :------ |
| `namespace` | `string` |
| `localName` | `string` |

#### Returns

`boolean`

#### Inherited from

HTMLElement.hasAttributeNS

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7751

___

### hasAttributes

▸ **hasAttributes**(): `boolean`

Returns true if element has attributes, and false otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/hasAttributes)

#### Returns

`boolean`

#### Inherited from

HTMLElement.hasAttributes

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7757

___

### hasChildNodes

▸ **hasChildNodes**(): `boolean`

Returns whether node has children.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/hasChildNodes)

#### Returns

`boolean`

#### Inherited from

HTMLElement.hasChildNodes

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16174

___

### hasPointerCapture

▸ **hasPointerCapture**(`pointerId`): `boolean`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/hasPointerCapture)

#### Parameters

| Name | Type |
| :------ | :------ |
| `pointerId` | `number` |

#### Returns

`boolean`

#### Inherited from

HTMLElement.hasPointerCapture

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7759

___

### hidePopover

▸ **hidePopover**(): `void`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/hidePopover)

#### Returns

`void`

#### Inherited from

HTMLElement.hidePopover

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:10091

___

### insertAdjacentElement

▸ **insertAdjacentElement**(`where`, `element`): `Element`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/insertAdjacentElement)

#### Parameters

| Name | Type |
| :------ | :------ |
| `where` | `InsertPosition` |
| `element` | `Element` |

#### Returns

`Element`

#### Inherited from

HTMLElement.insertAdjacentElement

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7761

___

### insertAdjacentHTML

▸ **insertAdjacentHTML**(`position`, `text`): `void`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/insertAdjacentHTML)

#### Parameters

| Name | Type |
| :------ | :------ |
| `position` | `InsertPosition` |
| `text` | `string` |

#### Returns

`void`

#### Inherited from

HTMLElement.insertAdjacentHTML

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7763

___

### insertAdjacentText

▸ **insertAdjacentText**(`where`, `data`): `void`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/insertAdjacentText)

#### Parameters

| Name | Type |
| :------ | :------ |
| `where` | `InsertPosition` |
| `data` | `string` |

#### Returns

`void`

#### Inherited from

HTMLElement.insertAdjacentText

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7765

___

### insertBefore

▸ **insertBefore**<`T`\>(`node`, `child`): `T`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/insertBefore)

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `Node` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `node` | `T` |
| `child` | `Node` |

#### Returns

`T`

#### Inherited from

HTMLElement.insertBefore

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16176

___

### isDefaultNamespace

▸ **isDefaultNamespace**(`namespace`): `boolean`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/isDefaultNamespace)

#### Parameters

| Name | Type |
| :------ | :------ |
| `namespace` | `string` |

#### Returns

`boolean`

#### Inherited from

HTMLElement.isDefaultNamespace

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16178

___

### isEqualNode

▸ **isEqualNode**(`otherNode`): `boolean`

Returns whether node and otherNode have the same properties.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/isEqualNode)

#### Parameters

| Name | Type |
| :------ | :------ |
| `otherNode` | `Node` |

#### Returns

`boolean`

#### Inherited from

HTMLElement.isEqualNode

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16184

___

### isSameNode

▸ **isSameNode**(`otherNode`): `boolean`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/isSameNode)

#### Parameters

| Name | Type |
| :------ | :------ |
| `otherNode` | `Node` |

#### Returns

`boolean`

#### Inherited from

HTMLElement.isSameNode

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16186

___

### lookupNamespaceURI

▸ **lookupNamespaceURI**(`prefix`): `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/lookupNamespaceURI)

#### Parameters

| Name | Type |
| :------ | :------ |
| `prefix` | `string` |

#### Returns

`string`

#### Inherited from

HTMLElement.lookupNamespaceURI

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16188

___

### lookupPrefix

▸ **lookupPrefix**(`namespace`): `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/lookupPrefix)

#### Parameters

| Name | Type |
| :------ | :------ |
| `namespace` | `string` |

#### Returns

`string`

#### Inherited from

HTMLElement.lookupPrefix

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16190

___

### matches

▸ **matches**(`selectors`): `boolean`

Returns true if matching selectors against element's root yields element, and false otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/matches)

#### Parameters

| Name | Type |
| :------ | :------ |
| `selectors` | `string` |

#### Returns

`boolean`

#### Inherited from

HTMLElement.matches

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7771

___

### normalize

▸ **normalize**(): `void`

Removes empty exclusive Text nodes and concatenates the data of remaining contiguous exclusive Text nodes into the first of their nodes.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/normalize)

#### Returns

`void`

#### Inherited from

HTMLElement.normalize

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16196

___

### plait

▸ `Optional` **plait**(`props`): `void` \| `Promise`<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `props` | [`PlaitProps`](../modules/plaited_component.md#plaitprops) |

#### Returns

`void` \| `Promise`<`void`\>

#### Defined in

[libs/component/src/types.ts:31](https://github.com/plaited/plaited/blob/65db093/libs/component/src/types.ts#L31)

___

### prepend

▸ **prepend**(`...nodes`): `void`

Inserts nodes before the first child of node, while replacing strings in nodes with equivalent Text nodes.

Throws a "HierarchyRequestError" DOMException if the constraints of the node tree are violated.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Document/prepend)

#### Parameters

| Name | Type |
| :------ | :------ |
| `...nodes` | (`string` \| `Node`)[] |

#### Returns

`void`

#### Inherited from

HTMLElement.prepend

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16795

___

### querySelector

▸ **querySelector**<`K`\>(`selectors`): `HTMLElementTagNameMap`[`K`]

Returns the first element that is a descendant of node that matches selectors.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Document/querySelector)

#### Type parameters

| Name | Type |
| :------ | :------ |
| `K` | extends keyof `HTMLElementTagNameMap` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `selectors` | `K` |

#### Returns

`HTMLElementTagNameMap`[`K`]

#### Inherited from

HTMLElement.querySelector

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16801

▸ **querySelector**<`K`\>(`selectors`): `SVGElementTagNameMap`[`K`]

#### Type parameters

| Name | Type |
| :------ | :------ |
| `K` | extends keyof `SVGElementTagNameMap` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `selectors` | `K` |

#### Returns

`SVGElementTagNameMap`[`K`]

#### Inherited from

HTMLElement.querySelector

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16802

▸ **querySelector**<`K`\>(`selectors`): `MathMLElementTagNameMap`[`K`]

#### Type parameters

| Name | Type |
| :------ | :------ |
| `K` | extends keyof `MathMLElementTagNameMap` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `selectors` | `K` |

#### Returns

`MathMLElementTagNameMap`[`K`]

#### Inherited from

HTMLElement.querySelector

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16803

▸ **querySelector**<`K`\>(`selectors`): `HTMLElementDeprecatedTagNameMap`[`K`]

#### Type parameters

| Name | Type |
| :------ | :------ |
| `K` | extends keyof `HTMLElementDeprecatedTagNameMap` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `selectors` | `K` |

#### Returns

`HTMLElementDeprecatedTagNameMap`[`K`]

**`Deprecated`**

#### Inherited from

HTMLElement.querySelector

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16805

▸ **querySelector**<`E`\>(`selectors`): `E`

#### Type parameters

| Name | Type |
| :------ | :------ |
| `E` | extends `Element` = `Element` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `selectors` | `string` |

#### Returns

`E`

#### Inherited from

HTMLElement.querySelector

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16806

___

### querySelectorAll

▸ **querySelectorAll**<`K`\>(`selectors`): `NodeListOf`<`HTMLElementTagNameMap`[`K`]\>

Returns all element descendants of node that match selectors.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Document/querySelectorAll)

#### Type parameters

| Name | Type |
| :------ | :------ |
| `K` | extends keyof `HTMLElementTagNameMap` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `selectors` | `K` |

#### Returns

`NodeListOf`<`HTMLElementTagNameMap`[`K`]\>

#### Inherited from

HTMLElement.querySelectorAll

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16812

▸ **querySelectorAll**<`K`\>(`selectors`): `NodeListOf`<`SVGElementTagNameMap`[`K`]\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `K` | extends keyof `SVGElementTagNameMap` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `selectors` | `K` |

#### Returns

`NodeListOf`<`SVGElementTagNameMap`[`K`]\>

#### Inherited from

HTMLElement.querySelectorAll

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16813

▸ **querySelectorAll**<`K`\>(`selectors`): `NodeListOf`<`MathMLElementTagNameMap`[`K`]\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `K` | extends keyof `MathMLElementTagNameMap` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `selectors` | `K` |

#### Returns

`NodeListOf`<`MathMLElementTagNameMap`[`K`]\>

#### Inherited from

HTMLElement.querySelectorAll

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16814

▸ **querySelectorAll**<`K`\>(`selectors`): `NodeListOf`<`HTMLElementDeprecatedTagNameMap`[`K`]\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `K` | extends keyof `HTMLElementDeprecatedTagNameMap` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `selectors` | `K` |

#### Returns

`NodeListOf`<`HTMLElementDeprecatedTagNameMap`[`K`]\>

**`Deprecated`**

#### Inherited from

HTMLElement.querySelectorAll

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16816

▸ **querySelectorAll**<`E`\>(`selectors`): `NodeListOf`<`E`\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `E` | extends `Element` = `Element` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `selectors` | `string` |

#### Returns

`NodeListOf`<`E`\>

#### Inherited from

HTMLElement.querySelectorAll

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16817

___

### releasePointerCapture

▸ **releasePointerCapture**(`pointerId`): `void`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/releasePointerCapture)

#### Parameters

| Name | Type |
| :------ | :------ |
| `pointerId` | `number` |

#### Returns

`void`

#### Inherited from

HTMLElement.releasePointerCapture

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7773

___

### remove

▸ **remove**(): `void`

Removes node.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/CharacterData/remove)

#### Returns

`void`

#### Inherited from

HTMLElement.remove

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:5611

___

### removeAttribute

▸ **removeAttribute**(`qualifiedName`): `void`

Removes element's first attribute whose qualified name is qualifiedName.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/removeAttribute)

#### Parameters

| Name | Type |
| :------ | :------ |
| `qualifiedName` | `string` |

#### Returns

`void`

#### Inherited from

HTMLElement.removeAttribute

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7779

___

### removeAttributeNS

▸ **removeAttributeNS**(`namespace`, `localName`): `void`

Removes element's attribute whose namespace is namespace and local name is localName.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/removeAttributeNS)

#### Parameters

| Name | Type |
| :------ | :------ |
| `namespace` | `string` |
| `localName` | `string` |

#### Returns

`void`

#### Inherited from

HTMLElement.removeAttributeNS

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7785

___

### removeAttributeNode

▸ **removeAttributeNode**(`attr`): `Attr`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/removeAttributeNode)

#### Parameters

| Name | Type |
| :------ | :------ |
| `attr` | `Attr` |

#### Returns

`Attr`

#### Inherited from

HTMLElement.removeAttributeNode

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7787

___

### removeChild

▸ **removeChild**<`T`\>(`child`): `T`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/removeChild)

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `Node` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `child` | `T` |

#### Returns

`T`

#### Inherited from

HTMLElement.removeChild

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16198

___

### removeEventListener

▸ **removeEventListener**<`K`\>(`type`, `listener`, `options?`): `void`

#### Type parameters

| Name | Type |
| :------ | :------ |
| `K` | extends keyof `HTMLElementEventMap` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `type` | `K` |
| `listener` | (`this`: `HTMLElement`, `ev`: `HTMLElementEventMap`[`K`]) => `any` |
| `options?` | `boolean` \| `EventListenerOptions` |

#### Returns

`void`

#### Inherited from

HTMLElement.removeEventListener

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:10098

▸ **removeEventListener**(`type`, `listener`, `options?`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `type` | `string` |
| `listener` | `EventListenerOrEventListenerObject` |
| `options?` | `boolean` \| `EventListenerOptions` |

#### Returns

`void`

#### Inherited from

HTMLElement.removeEventListener

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:10099

___

### replaceChild

▸ **replaceChild**<`T`\>(`node`, `child`): `T`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/replaceChild)

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `Node` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `node` | `Node` |
| `child` | `T` |

#### Returns

`T`

#### Inherited from

HTMLElement.replaceChild

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16200

___

### replaceChildren

▸ **replaceChildren**(`...nodes`): `void`

Replace all children of node with nodes, while replacing strings in nodes with equivalent Text nodes.

Throws a "HierarchyRequestError" DOMException if the constraints of the node tree are violated.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Document/replaceChildren)

#### Parameters

| Name | Type |
| :------ | :------ |
| `...nodes` | (`string` \| `Node`)[] |

#### Returns

`void`

#### Inherited from

HTMLElement.replaceChildren

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:16825

___

### replaceWith

▸ **replaceWith**(`...nodes`): `void`

Replaces node with nodes, while replacing strings in nodes with equivalent Text nodes.

Throws a "HierarchyRequestError" DOMException if the constraints of the node tree are violated.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/CharacterData/replaceWith)

#### Parameters

| Name | Type |
| :------ | :------ |
| `...nodes` | (`string` \| `Node`)[] |

#### Returns

`void`

#### Inherited from

HTMLElement.replaceWith

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:5619

___

### requestFullscreen

▸ **requestFullscreen**(`options?`): `Promise`<`void`\>

Displays element fullscreen and resolves promise when done.

When supplied, options's navigationUI member indicates whether showing navigation UI while in fullscreen is preferred or not. If set to "show", navigation simplicity is preferred over screen space, and if set to "hide", more screen space is preferred. User agents are always free to honor user preference over the application's. The default value "auto" indicates no application preference.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/requestFullscreen)

#### Parameters

| Name | Type |
| :------ | :------ |
| `options?` | `FullscreenOptions` |

#### Returns

`Promise`<`void`\>

#### Inherited from

HTMLElement.requestFullscreen

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7795

___

### requestPointerLock

▸ **requestPointerLock**(): `void`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/requestPointerLock)

#### Returns

`void`

#### Inherited from

HTMLElement.requestPointerLock

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7797

___

### scroll

▸ **scroll**(`options?`): `void`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/scroll)

#### Parameters

| Name | Type |
| :------ | :------ |
| `options?` | `ScrollToOptions` |

#### Returns

`void`

#### Inherited from

HTMLElement.scroll

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7799

▸ **scroll**(`x`, `y`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `x` | `number` |
| `y` | `number` |

#### Returns

`void`

#### Inherited from

HTMLElement.scroll

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7800

___

### scrollBy

▸ **scrollBy**(`options?`): `void`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/scrollBy)

#### Parameters

| Name | Type |
| :------ | :------ |
| `options?` | `ScrollToOptions` |

#### Returns

`void`

#### Inherited from

HTMLElement.scrollBy

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7802

▸ **scrollBy**(`x`, `y`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `x` | `number` |
| `y` | `number` |

#### Returns

`void`

#### Inherited from

HTMLElement.scrollBy

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7803

___

### scrollIntoView

▸ **scrollIntoView**(`arg?`): `void`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/scrollIntoView)

#### Parameters

| Name | Type |
| :------ | :------ |
| `arg?` | `boolean` \| `ScrollIntoViewOptions` |

#### Returns

`void`

#### Inherited from

HTMLElement.scrollIntoView

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7805

___

### scrollTo

▸ **scrollTo**(`options?`): `void`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/scrollTo)

#### Parameters

| Name | Type |
| :------ | :------ |
| `options?` | `ScrollToOptions` |

#### Returns

`void`

#### Inherited from

HTMLElement.scrollTo

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7807

▸ **scrollTo**(`x`, `y`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `x` | `number` |
| `y` | `number` |

#### Returns

`void`

#### Inherited from

HTMLElement.scrollTo

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7808

___

### setAttribute

▸ **setAttribute**(`qualifiedName`, `value`): `void`

Sets the value of element's first attribute whose qualified name is qualifiedName to value.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/setAttribute)

#### Parameters

| Name | Type |
| :------ | :------ |
| `qualifiedName` | `string` |
| `value` | `string` |

#### Returns

`void`

#### Inherited from

HTMLElement.setAttribute

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7814

___

### setAttributeNS

▸ **setAttributeNS**(`namespace`, `qualifiedName`, `value`): `void`

Sets the value of element's attribute whose namespace is namespace and local name is localName to value.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/setAttributeNS)

#### Parameters

| Name | Type |
| :------ | :------ |
| `namespace` | `string` |
| `qualifiedName` | `string` |
| `value` | `string` |

#### Returns

`void`

#### Inherited from

HTMLElement.setAttributeNS

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7820

___

### setAttributeNode

▸ **setAttributeNode**(`attr`): `Attr`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/setAttributeNode)

#### Parameters

| Name | Type |
| :------ | :------ |
| `attr` | `Attr` |

#### Returns

`Attr`

#### Inherited from

HTMLElement.setAttributeNode

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7822

___

### setAttributeNodeNS

▸ **setAttributeNodeNS**(`attr`): `Attr`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/setAttributeNodeNS)

#### Parameters

| Name | Type |
| :------ | :------ |
| `attr` | `Attr` |

#### Returns

`Attr`

#### Inherited from

HTMLElement.setAttributeNodeNS

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7824

___

### setPointerCapture

▸ **setPointerCapture**(`pointerId`): `void`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/setPointerCapture)

#### Parameters

| Name | Type |
| :------ | :------ |
| `pointerId` | `number` |

#### Returns

`void`

#### Inherited from

HTMLElement.setPointerCapture

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7826

___

### showPopover

▸ **showPopover**(): `void`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/showPopover)

#### Returns

`void`

#### Inherited from

HTMLElement.showPopover

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:10093

___

### toggleAttribute

▸ **toggleAttribute**(`qualifiedName`, `force?`): `boolean`

If force is not given, "toggles" qualifiedName, removing it if it is present and adding it if it is not present. If force is true, adds qualifiedName. If force is false, removes qualifiedName.

Returns true if qualifiedName is now present, and false otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/toggleAttribute)

#### Parameters

| Name | Type |
| :------ | :------ |
| `qualifiedName` | `string` |
| `force?` | `boolean` |

#### Returns

`boolean`

#### Inherited from

HTMLElement.toggleAttribute

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7834

___

### togglePopover

▸ **togglePopover**(`force?`): `void`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/togglePopover)

#### Parameters

| Name | Type |
| :------ | :------ |
| `force?` | `boolean` |

#### Returns

`void`

#### Inherited from

HTMLElement.togglePopover

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:10095

___

### webkitMatchesSelector

▸ **webkitMatchesSelector**(`selectors`): `boolean`

#### Parameters

| Name | Type |
| :------ | :------ |
| `selectors` | `string` |

#### Returns

`boolean`

**`Deprecated`**

This is a legacy alias of `matches`.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/matches)

#### Inherited from

HTMLElement.webkitMatchesSelector

#### Defined in

node_modules/typescript/lib/lib.dom.d.ts:7840