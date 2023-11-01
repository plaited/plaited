**@plaited/component** ( [Readme](../README.md) \| API )

***

[Plaited Typedocs](../../../modules.md) / [@plaited/component](../modules.md) / PlaitedElement

# Interface: PlaitedElement

## Contents

- [Extends](PlaitedElement.md#extends)
- [Properties](PlaitedElement.md#properties)
  - [$](PlaitedElement.md#)
  - [ATTRIBUTE\_NODE](PlaitedElement.md#attribute-node)
  - [CDATA\_SECTION\_NODE](PlaitedElement.md#cdata-section-node)
  - [COMMENT\_NODE](PlaitedElement.md#comment-node)
  - [DOCUMENT\_FRAGMENT\_NODE](PlaitedElement.md#document-fragment-node)
  - [DOCUMENT\_NODE](PlaitedElement.md#document-node)
  - [DOCUMENT\_POSITION\_CONTAINED\_BY](PlaitedElement.md#document-position-contained-by)
  - [DOCUMENT\_POSITION\_CONTAINS](PlaitedElement.md#document-position-contains)
  - [DOCUMENT\_POSITION\_DISCONNECTED](PlaitedElement.md#document-position-disconnected)
  - [DOCUMENT\_POSITION\_FOLLOWING](PlaitedElement.md#document-position-following)
  - [DOCUMENT\_POSITION\_IMPLEMENTATION\_SPECIFIC](PlaitedElement.md#document-position-implementation-specific)
  - [DOCUMENT\_POSITION\_PRECEDING](PlaitedElement.md#document-position-preceding)
  - [DOCUMENT\_TYPE\_NODE](PlaitedElement.md#document-type-node)
  - [ELEMENT\_NODE](PlaitedElement.md#element-node)
  - [ENTITY\_NODE](PlaitedElement.md#entity-node)
  - [ENTITY\_REFERENCE\_NODE](PlaitedElement.md#entity-reference-node)
  - [NOTATION\_NODE](PlaitedElement.md#notation-node)
  - [PROCESSING\_INSTRUCTION\_NODE](PlaitedElement.md#processing-instruction-node)
  - [TEXT\_NODE](PlaitedElement.md#text-node)
  - [accessKey](PlaitedElement.md#accesskey)
  - [accessKeyLabel](PlaitedElement.md#accesskeylabel)
  - [ariaAtomic](PlaitedElement.md#ariaatomic)
  - [ariaAutoComplete](PlaitedElement.md#ariaautocomplete)
  - [ariaBusy](PlaitedElement.md#ariabusy)
  - [ariaChecked](PlaitedElement.md#ariachecked)
  - [ariaColCount](PlaitedElement.md#ariacolcount)
  - [ariaColIndex](PlaitedElement.md#ariacolindex)
  - [ariaColSpan](PlaitedElement.md#ariacolspan)
  - [ariaCurrent](PlaitedElement.md#ariacurrent)
  - [ariaDisabled](PlaitedElement.md#ariadisabled)
  - [ariaExpanded](PlaitedElement.md#ariaexpanded)
  - [ariaHasPopup](PlaitedElement.md#ariahaspopup)
  - [ariaHidden](PlaitedElement.md#ariahidden)
  - [ariaInvalid](PlaitedElement.md#ariainvalid)
  - [ariaKeyShortcuts](PlaitedElement.md#ariakeyshortcuts)
  - [ariaLabel](PlaitedElement.md#arialabel)
  - [ariaLevel](PlaitedElement.md#arialevel)
  - [ariaLive](PlaitedElement.md#arialive)
  - [ariaModal](PlaitedElement.md#ariamodal)
  - [ariaMultiLine](PlaitedElement.md#ariamultiline)
  - [ariaMultiSelectable](PlaitedElement.md#ariamultiselectable)
  - [ariaOrientation](PlaitedElement.md#ariaorientation)
  - [ariaPlaceholder](PlaitedElement.md#ariaplaceholder)
  - [ariaPosInSet](PlaitedElement.md#ariaposinset)
  - [ariaPressed](PlaitedElement.md#ariapressed)
  - [ariaReadOnly](PlaitedElement.md#ariareadonly)
  - [ariaRequired](PlaitedElement.md#ariarequired)
  - [ariaRoleDescription](PlaitedElement.md#ariaroledescription)
  - [ariaRowCount](PlaitedElement.md#ariarowcount)
  - [ariaRowIndex](PlaitedElement.md#ariarowindex)
  - [ariaRowSpan](PlaitedElement.md#ariarowspan)
  - [ariaSelected](PlaitedElement.md#ariaselected)
  - [ariaSetSize](PlaitedElement.md#ariasetsize)
  - [ariaSort](PlaitedElement.md#ariasort)
  - [ariaValueMax](PlaitedElement.md#ariavaluemax)
  - [ariaValueMin](PlaitedElement.md#ariavaluemin)
  - [ariaValueNow](PlaitedElement.md#ariavaluenow)
  - [ariaValueText](PlaitedElement.md#ariavaluetext)
  - [assignedSlot](PlaitedElement.md#assignedslot)
  - [attributeStyleMap](PlaitedElement.md#attributestylemap)
  - [attributes](PlaitedElement.md#attributes)
  - [autocapitalize](PlaitedElement.md#autocapitalize)
  - [autofocus](PlaitedElement.md#autofocus)
  - [baseURI](PlaitedElement.md#baseuri)
  - [childElementCount](PlaitedElement.md#childelementcount)
  - [childNodes](PlaitedElement.md#childnodes)
  - [children](PlaitedElement.md#children)
  - [classList](PlaitedElement.md#classlist)
  - [className](PlaitedElement.md#classname)
  - [clientHeight](PlaitedElement.md#clientheight)
  - [clientLeft](PlaitedElement.md#clientleft)
  - [clientTop](PlaitedElement.md#clienttop)
  - [clientWidth](PlaitedElement.md#clientwidth)
  - [contentEditable](PlaitedElement.md#contenteditable)
  - [dataset](PlaitedElement.md#dataset)
  - [dir](PlaitedElement.md#dir)
  - [draggable](PlaitedElement.md#draggable)
  - [enterKeyHint](PlaitedElement.md#enterkeyhint)
  - [firstChild](PlaitedElement.md#firstchild)
  - [firstElementChild](PlaitedElement.md#firstelementchild)
  - [hidden](PlaitedElement.md#hidden)
  - [id](PlaitedElement.md#id)
  - [inert](PlaitedElement.md#inert)
  - [innerHTML](PlaitedElement.md#innerhtml)
  - [innerText](PlaitedElement.md#innertext)
  - [inputMode](PlaitedElement.md#inputmode)
  - [internals\_](PlaitedElement.md#internals)
  - [isConnected](PlaitedElement.md#isconnected)
  - [isContentEditable](PlaitedElement.md#iscontenteditable)
  - [lang](PlaitedElement.md#lang)
  - [lastChild](PlaitedElement.md#lastchild)
  - [lastElementChild](PlaitedElement.md#lastelementchild)
  - [localName](PlaitedElement.md#localname)
  - [namespaceURI](PlaitedElement.md#namespaceuri)
  - [nextElementSibling](PlaitedElement.md#nextelementsibling)
  - [nextSibling](PlaitedElement.md#nextsibling)
  - [nodeName](PlaitedElement.md#nodename)
  - [nodeType](PlaitedElement.md#nodetype)
  - [nodeValue](PlaitedElement.md#nodevalue)
  - [nonce](PlaitedElement.md#nonce)
  - [offsetHeight](PlaitedElement.md#offsetheight)
  - [offsetLeft](PlaitedElement.md#offsetleft)
  - [offsetParent](PlaitedElement.md#offsetparent)
  - [offsetTop](PlaitedElement.md#offsettop)
  - [offsetWidth](PlaitedElement.md#offsetwidth)
  - [onabort](PlaitedElement.md#onabort)
  - [onanimationcancel](PlaitedElement.md#onanimationcancel)
  - [onanimationend](PlaitedElement.md#onanimationend)
  - [onanimationiteration](PlaitedElement.md#onanimationiteration)
  - [onanimationstart](PlaitedElement.md#onanimationstart)
  - [onauxclick](PlaitedElement.md#onauxclick)
  - [onbeforeinput](PlaitedElement.md#onbeforeinput)
  - [onblur](PlaitedElement.md#onblur)
  - [oncancel](PlaitedElement.md#oncancel)
  - [oncanplay](PlaitedElement.md#oncanplay)
  - [oncanplaythrough](PlaitedElement.md#oncanplaythrough)
  - [onchange](PlaitedElement.md#onchange)
  - [onclick](PlaitedElement.md#onclick)
  - [onclose](PlaitedElement.md#onclose)
  - [oncontextmenu](PlaitedElement.md#oncontextmenu)
  - [oncopy](PlaitedElement.md#oncopy)
  - [oncuechange](PlaitedElement.md#oncuechange)
  - [oncut](PlaitedElement.md#oncut)
  - [ondblclick](PlaitedElement.md#ondblclick)
  - [ondrag](PlaitedElement.md#ondrag)
  - [ondragend](PlaitedElement.md#ondragend)
  - [ondragenter](PlaitedElement.md#ondragenter)
  - [ondragleave](PlaitedElement.md#ondragleave)
  - [ondragover](PlaitedElement.md#ondragover)
  - [ondragstart](PlaitedElement.md#ondragstart)
  - [ondrop](PlaitedElement.md#ondrop)
  - [ondurationchange](PlaitedElement.md#ondurationchange)
  - [onemptied](PlaitedElement.md#onemptied)
  - [onended](PlaitedElement.md#onended)
  - [onerror](PlaitedElement.md#onerror)
  - [onfocus](PlaitedElement.md#onfocus)
  - [onformdata](PlaitedElement.md#onformdata)
  - [onfullscreenchange](PlaitedElement.md#onfullscreenchange)
  - [onfullscreenerror](PlaitedElement.md#onfullscreenerror)
  - [ongotpointercapture](PlaitedElement.md#ongotpointercapture)
  - [oninput](PlaitedElement.md#oninput)
  - [oninvalid](PlaitedElement.md#oninvalid)
  - [onkeydown](PlaitedElement.md#onkeydown)
  - [onkeypress](PlaitedElement.md#onkeypress)
  - [onkeyup](PlaitedElement.md#onkeyup)
  - [onload](PlaitedElement.md#onload)
  - [onloadeddata](PlaitedElement.md#onloadeddata)
  - [onloadedmetadata](PlaitedElement.md#onloadedmetadata)
  - [onloadstart](PlaitedElement.md#onloadstart)
  - [onlostpointercapture](PlaitedElement.md#onlostpointercapture)
  - [onmousedown](PlaitedElement.md#onmousedown)
  - [onmouseenter](PlaitedElement.md#onmouseenter)
  - [onmouseleave](PlaitedElement.md#onmouseleave)
  - [onmousemove](PlaitedElement.md#onmousemove)
  - [onmouseout](PlaitedElement.md#onmouseout)
  - [onmouseover](PlaitedElement.md#onmouseover)
  - [onmouseup](PlaitedElement.md#onmouseup)
  - [onpaste](PlaitedElement.md#onpaste)
  - [onpause](PlaitedElement.md#onpause)
  - [onplay](PlaitedElement.md#onplay)
  - [onplaying](PlaitedElement.md#onplaying)
  - [onpointercancel](PlaitedElement.md#onpointercancel)
  - [onpointerdown](PlaitedElement.md#onpointerdown)
  - [onpointerenter](PlaitedElement.md#onpointerenter)
  - [onpointerleave](PlaitedElement.md#onpointerleave)
  - [onpointermove](PlaitedElement.md#onpointermove)
  - [onpointerout](PlaitedElement.md#onpointerout)
  - [onpointerover](PlaitedElement.md#onpointerover)
  - [onpointerup](PlaitedElement.md#onpointerup)
  - [onprogress](PlaitedElement.md#onprogress)
  - [onratechange](PlaitedElement.md#onratechange)
  - [onreset](PlaitedElement.md#onreset)
  - [onresize](PlaitedElement.md#onresize)
  - [onscroll](PlaitedElement.md#onscroll)
  - [onscrollend](PlaitedElement.md#onscrollend)
  - [onsecuritypolicyviolation](PlaitedElement.md#onsecuritypolicyviolation)
  - [onseeked](PlaitedElement.md#onseeked)
  - [onseeking](PlaitedElement.md#onseeking)
  - [onselect](PlaitedElement.md#onselect)
  - [onselectionchange](PlaitedElement.md#onselectionchange)
  - [onselectstart](PlaitedElement.md#onselectstart)
  - [onslotchange](PlaitedElement.md#onslotchange)
  - [onstalled](PlaitedElement.md#onstalled)
  - [onsubmit](PlaitedElement.md#onsubmit)
  - [onsuspend](PlaitedElement.md#onsuspend)
  - [ontimeupdate](PlaitedElement.md#ontimeupdate)
  - [ontoggle](PlaitedElement.md#ontoggle)
  - [ontouchcancel](PlaitedElement.md#ontouchcancel)
  - [ontouchend](PlaitedElement.md#ontouchend)
  - [ontouchmove](PlaitedElement.md#ontouchmove)
  - [ontouchstart](PlaitedElement.md#ontouchstart)
  - [ontransitioncancel](PlaitedElement.md#ontransitioncancel)
  - [ontransitionend](PlaitedElement.md#ontransitionend)
  - [ontransitionrun](PlaitedElement.md#ontransitionrun)
  - [ontransitionstart](PlaitedElement.md#ontransitionstart)
  - [onvolumechange](PlaitedElement.md#onvolumechange)
  - [onwaiting](PlaitedElement.md#onwaiting)
  - [onwebkitanimationend](PlaitedElement.md#onwebkitanimationend)
  - [onwebkitanimationiteration](PlaitedElement.md#onwebkitanimationiteration)
  - [onwebkitanimationstart](PlaitedElement.md#onwebkitanimationstart)
  - [onwebkittransitionend](PlaitedElement.md#onwebkittransitionend)
  - [onwheel](PlaitedElement.md#onwheel)
  - [outerHTML](PlaitedElement.md#outerhtml)
  - [outerText](PlaitedElement.md#outertext)
  - [ownerDocument](PlaitedElement.md#ownerdocument)
  - [parentElement](PlaitedElement.md#parentelement)
  - [parentNode](PlaitedElement.md#parentnode)
  - [part](PlaitedElement.md#part)
  - [popover](PlaitedElement.md#popover)
  - [prefix](PlaitedElement.md#prefix)
  - [previousElementSibling](PlaitedElement.md#previouselementsibling)
  - [previousSibling](PlaitedElement.md#previoussibling)
  - [role](PlaitedElement.md#role)
  - [scrollHeight](PlaitedElement.md#scrollheight)
  - [scrollLeft](PlaitedElement.md#scrollleft)
  - [scrollTop](PlaitedElement.md#scrolltop)
  - [scrollWidth](PlaitedElement.md#scrollwidth)
  - [shadowRoot](PlaitedElement.md#shadowroot)
  - [slot](PlaitedElement.md#slot)
  - [spellcheck](PlaitedElement.md#spellcheck)
  - [style](PlaitedElement.md#style)
  - [tabIndex](PlaitedElement.md#tabindex)
  - [tagName](PlaitedElement.md#tagname)
  - [textContent](PlaitedElement.md#textcontent)
  - [title](PlaitedElement.md#title)
  - [translate](PlaitedElement.md#translate)
- [Methods](PlaitedElement.md#methods)
  - [addEventListener()](PlaitedElement.md#addeventlistener)
  - [adoptedCallback()](PlaitedElement.md#adoptedcallback)
  - [after()](PlaitedElement.md#after)
  - [animate()](PlaitedElement.md#animate)
  - [append()](PlaitedElement.md#append)
  - [appendChild()](PlaitedElement.md#appendchild)
  - [attachInternals()](PlaitedElement.md#attachinternals)
  - [attachShadow()](PlaitedElement.md#attachshadow)
  - [attributeChangedCallback()](PlaitedElement.md#attributechangedcallback)
  - [before()](PlaitedElement.md#before)
  - [blur()](PlaitedElement.md#blur)
  - [checkVisibility()](PlaitedElement.md#checkvisibility)
  - [click()](PlaitedElement.md#click)
  - [cloneNode()](PlaitedElement.md#clonenode)
  - [closest()](PlaitedElement.md#closest)
  - [compareDocumentPosition()](PlaitedElement.md#comparedocumentposition)
  - [computedStyleMap()](PlaitedElement.md#computedstylemap)
  - [connectedCallback()](PlaitedElement.md#connectedcallback)
  - [contains()](PlaitedElement.md#contains)
  - [disconnectedCallback()](PlaitedElement.md#disconnectedcallback)
  - [dispatchEvent()](PlaitedElement.md#dispatchevent)
  - [focus()](PlaitedElement.md#focus)
  - [formAssociatedCallback()](PlaitedElement.md#formassociatedcallback)
  - [formDisabledCallback()](PlaitedElement.md#formdisabledcallback)
  - [formResetCallback()](PlaitedElement.md#formresetcallback)
  - [formStateRestoreCallback()](PlaitedElement.md#formstaterestorecallback)
  - [getAnimations()](PlaitedElement.md#getanimations)
  - [getAttribute()](PlaitedElement.md#getattribute)
  - [getAttributeNS()](PlaitedElement.md#getattributens)
  - [getAttributeNames()](PlaitedElement.md#getattributenames)
  - [getAttributeNode()](PlaitedElement.md#getattributenode)
  - [getAttributeNodeNS()](PlaitedElement.md#getattributenodens)
  - [getBoundingClientRect()](PlaitedElement.md#getboundingclientrect)
  - [getClientRects()](PlaitedElement.md#getclientrects)
  - [getElementsByClassName()](PlaitedElement.md#getelementsbyclassname)
  - [getElementsByTagName()](PlaitedElement.md#getelementsbytagname)
  - [getElementsByTagNameNS()](PlaitedElement.md#getelementsbytagnamens)
  - [getRootNode()](PlaitedElement.md#getrootnode)
  - [hasAttribute()](PlaitedElement.md#hasattribute)
  - [hasAttributeNS()](PlaitedElement.md#hasattributens)
  - [hasAttributes()](PlaitedElement.md#hasattributes)
  - [hasChildNodes()](PlaitedElement.md#haschildnodes)
  - [hasPointerCapture()](PlaitedElement.md#haspointercapture)
  - [hidePopover()](PlaitedElement.md#hidepopover)
  - [insertAdjacentElement()](PlaitedElement.md#insertadjacentelement)
  - [insertAdjacentHTML()](PlaitedElement.md#insertadjacenthtml)
  - [insertAdjacentText()](PlaitedElement.md#insertadjacenttext)
  - [insertBefore()](PlaitedElement.md#insertbefore)
  - [isDefaultNamespace()](PlaitedElement.md#isdefaultnamespace)
  - [isEqualNode()](PlaitedElement.md#isequalnode)
  - [isSameNode()](PlaitedElement.md#issamenode)
  - [lookupNamespaceURI()](PlaitedElement.md#lookupnamespaceuri)
  - [lookupPrefix()](PlaitedElement.md#lookupprefix)
  - [matches()](PlaitedElement.md#matches)
  - [normalize()](PlaitedElement.md#normalize)
  - [plait()](PlaitedElement.md#plait)
  - [prepend()](PlaitedElement.md#prepend)
  - [querySelector()](PlaitedElement.md#queryselector)
  - [querySelectorAll()](PlaitedElement.md#queryselectorall)
  - [releasePointerCapture()](PlaitedElement.md#releasepointercapture)
  - [remove()](PlaitedElement.md#remove)
  - [removeAttribute()](PlaitedElement.md#removeattribute)
  - [removeAttributeNS()](PlaitedElement.md#removeattributens)
  - [removeAttributeNode()](PlaitedElement.md#removeattributenode)
  - [removeChild()](PlaitedElement.md#removechild)
  - [removeEventListener()](PlaitedElement.md#removeeventlistener)
  - [replaceChild()](PlaitedElement.md#replacechild)
  - [replaceChildren()](PlaitedElement.md#replacechildren)
  - [replaceWith()](PlaitedElement.md#replacewith)
  - [requestFullscreen()](PlaitedElement.md#requestfullscreen)
  - [requestPointerLock()](PlaitedElement.md#requestpointerlock)
  - [scroll()](PlaitedElement.md#scroll)
  - [scrollBy()](PlaitedElement.md#scrollby)
  - [scrollIntoView()](PlaitedElement.md#scrollintoview)
  - [scrollTo()](PlaitedElement.md#scrollto)
  - [setAttribute()](PlaitedElement.md#setattribute)
  - [setAttributeNS()](PlaitedElement.md#setattributens)
  - [setAttributeNode()](PlaitedElement.md#setattributenode)
  - [setAttributeNodeNS()](PlaitedElement.md#setattributenodens)
  - [setPointerCapture()](PlaitedElement.md#setpointercapture)
  - [showPopover()](PlaitedElement.md#showpopover)
  - [toggleAttribute()](PlaitedElement.md#toggleattribute)
  - [togglePopover()](PlaitedElement.md#togglepopover)
  - [webkitMatchesSelector()](PlaitedElement.md#webkitmatchesselector)

## Extends

- `HTMLElement`

## Properties

### $

> **$**: [`$`]($.md)

#### Source

[libs/component/src/types.ts:38](https://github.com/plaited/plaited/blob/317e868/libs/component/src/types.ts#L38)

***

### ATTRIBUTE\_NODE

> **`readonly`** **ATTRIBUTE\_NODE**: `2`

#### Inherited from

HTMLElement.ATTRIBUTE\_NODE

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16203

***

### CDATA\_SECTION\_NODE

> **`readonly`** **CDATA\_SECTION\_NODE**: `4`

node is a CDATASection node.

#### Inherited from

HTMLElement.CDATA\_SECTION\_NODE

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16207

***

### COMMENT\_NODE

> **`readonly`** **COMMENT\_NODE**: `8`

node is a Comment node.

#### Inherited from

HTMLElement.COMMENT\_NODE

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16213

***

### DOCUMENT\_FRAGMENT\_NODE

> **`readonly`** **DOCUMENT\_FRAGMENT\_NODE**: `11`

node is a DocumentFragment node.

#### Inherited from

HTMLElement.DOCUMENT\_FRAGMENT\_NODE

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16219

***

### DOCUMENT\_NODE

> **`readonly`** **DOCUMENT\_NODE**: `9`

node is a document.

#### Inherited from

HTMLElement.DOCUMENT\_NODE

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16215

***

### DOCUMENT\_POSITION\_CONTAINED\_BY

> **`readonly`** **DOCUMENT\_POSITION\_CONTAINED\_BY**: `16`

Set when other is a descendant of node.

#### Inherited from

HTMLElement.DOCUMENT\_POSITION\_CONTAINED\_BY

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16230

***

### DOCUMENT\_POSITION\_CONTAINS

> **`readonly`** **DOCUMENT\_POSITION\_CONTAINS**: `8`

Set when other is an ancestor of node.

#### Inherited from

HTMLElement.DOCUMENT\_POSITION\_CONTAINS

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16228

***

### DOCUMENT\_POSITION\_DISCONNECTED

> **`readonly`** **DOCUMENT\_POSITION\_DISCONNECTED**: `1`

Set when node and other are not in the same tree.

#### Inherited from

HTMLElement.DOCUMENT\_POSITION\_DISCONNECTED

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16222

***

### DOCUMENT\_POSITION\_FOLLOWING

> **`readonly`** **DOCUMENT\_POSITION\_FOLLOWING**: `4`

Set when other is following node.

#### Inherited from

HTMLElement.DOCUMENT\_POSITION\_FOLLOWING

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16226

***

### DOCUMENT\_POSITION\_IMPLEMENTATION\_SPECIFIC

> **`readonly`** **DOCUMENT\_POSITION\_IMPLEMENTATION\_SPECIFIC**: `32`

#### Inherited from

HTMLElement.DOCUMENT\_POSITION\_IMPLEMENTATION\_SPECIFIC

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16231

***

### DOCUMENT\_POSITION\_PRECEDING

> **`readonly`** **DOCUMENT\_POSITION\_PRECEDING**: `2`

Set when other is preceding node.

#### Inherited from

HTMLElement.DOCUMENT\_POSITION\_PRECEDING

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16224

***

### DOCUMENT\_TYPE\_NODE

> **`readonly`** **DOCUMENT\_TYPE\_NODE**: `10`

node is a doctype.

#### Inherited from

HTMLElement.DOCUMENT\_TYPE\_NODE

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16217

***

### ELEMENT\_NODE

> **`readonly`** **ELEMENT\_NODE**: `1`

node is an element.

#### Inherited from

HTMLElement.ELEMENT\_NODE

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16202

***

### ENTITY\_NODE

> **`readonly`** **ENTITY\_NODE**: `6`

#### Inherited from

HTMLElement.ENTITY\_NODE

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16209

***

### ENTITY\_REFERENCE\_NODE

> **`readonly`** **ENTITY\_REFERENCE\_NODE**: `5`

#### Inherited from

HTMLElement.ENTITY\_REFERENCE\_NODE

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16208

***

### NOTATION\_NODE

> **`readonly`** **NOTATION\_NODE**: `12`

#### Inherited from

HTMLElement.NOTATION\_NODE

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16220

***

### PROCESSING\_INSTRUCTION\_NODE

> **`readonly`** **PROCESSING\_INSTRUCTION\_NODE**: `7`

node is a ProcessingInstruction node.

#### Inherited from

HTMLElement.PROCESSING\_INSTRUCTION\_NODE

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16211

***

### TEXT\_NODE

> **`readonly`** **TEXT\_NODE**: `3`

node is a Text node.

#### Inherited from

HTMLElement.TEXT\_NODE

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16205

***

### accessKey

> **accessKey**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/accessKey)

#### Inherited from

HTMLElement.accessKey

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:10051

***

### accessKeyLabel

> **`readonly`** **accessKeyLabel**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/accessKeyLabel)

#### Inherited from

HTMLElement.accessKeyLabel

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:10053

***

### ariaAtomic

> **ariaAtomic**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaAtomic)

#### Inherited from

HTMLElement.ariaAtomic

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2207

***

### ariaAutoComplete

> **ariaAutoComplete**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaAutoComplete)

#### Inherited from

HTMLElement.ariaAutoComplete

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2209

***

### ariaBusy

> **ariaBusy**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaBusy)

#### Inherited from

HTMLElement.ariaBusy

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2211

***

### ariaChecked

> **ariaChecked**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaChecked)

#### Inherited from

HTMLElement.ariaChecked

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2213

***

### ariaColCount

> **ariaColCount**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaColCount)

#### Inherited from

HTMLElement.ariaColCount

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2215

***

### ariaColIndex

> **ariaColIndex**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaColIndex)

#### Inherited from

HTMLElement.ariaColIndex

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2217

***

### ariaColSpan

> **ariaColSpan**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaColSpan)

#### Inherited from

HTMLElement.ariaColSpan

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2219

***

### ariaCurrent

> **ariaCurrent**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaCurrent)

#### Inherited from

HTMLElement.ariaCurrent

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2221

***

### ariaDisabled

> **ariaDisabled**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaDisabled)

#### Inherited from

HTMLElement.ariaDisabled

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2223

***

### ariaExpanded

> **ariaExpanded**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaExpanded)

#### Inherited from

HTMLElement.ariaExpanded

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2225

***

### ariaHasPopup

> **ariaHasPopup**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaHasPopup)

#### Inherited from

HTMLElement.ariaHasPopup

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2227

***

### ariaHidden

> **ariaHidden**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaHidden)

#### Inherited from

HTMLElement.ariaHidden

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2229

***

### ariaInvalid

> **ariaInvalid**: `string`

#### Inherited from

HTMLElement.ariaInvalid

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2230

***

### ariaKeyShortcuts

> **ariaKeyShortcuts**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaKeyShortcuts)

#### Inherited from

HTMLElement.ariaKeyShortcuts

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2232

***

### ariaLabel

> **ariaLabel**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaLabel)

#### Inherited from

HTMLElement.ariaLabel

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2234

***

### ariaLevel

> **ariaLevel**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaLevel)

#### Inherited from

HTMLElement.ariaLevel

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2236

***

### ariaLive

> **ariaLive**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaLive)

#### Inherited from

HTMLElement.ariaLive

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2238

***

### ariaModal

> **ariaModal**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaModal)

#### Inherited from

HTMLElement.ariaModal

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2240

***

### ariaMultiLine

> **ariaMultiLine**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaMultiLine)

#### Inherited from

HTMLElement.ariaMultiLine

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2242

***

### ariaMultiSelectable

> **ariaMultiSelectable**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaMultiSelectable)

#### Inherited from

HTMLElement.ariaMultiSelectable

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2244

***

### ariaOrientation

> **ariaOrientation**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaOrientation)

#### Inherited from

HTMLElement.ariaOrientation

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2246

***

### ariaPlaceholder

> **ariaPlaceholder**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaPlaceholder)

#### Inherited from

HTMLElement.ariaPlaceholder

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2248

***

### ariaPosInSet

> **ariaPosInSet**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaPosInSet)

#### Inherited from

HTMLElement.ariaPosInSet

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2250

***

### ariaPressed

> **ariaPressed**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaPressed)

#### Inherited from

HTMLElement.ariaPressed

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2252

***

### ariaReadOnly

> **ariaReadOnly**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaReadOnly)

#### Inherited from

HTMLElement.ariaReadOnly

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2254

***

### ariaRequired

> **ariaRequired**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaRequired)

#### Inherited from

HTMLElement.ariaRequired

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2256

***

### ariaRoleDescription

> **ariaRoleDescription**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaRoleDescription)

#### Inherited from

HTMLElement.ariaRoleDescription

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2258

***

### ariaRowCount

> **ariaRowCount**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaRowCount)

#### Inherited from

HTMLElement.ariaRowCount

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2260

***

### ariaRowIndex

> **ariaRowIndex**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaRowIndex)

#### Inherited from

HTMLElement.ariaRowIndex

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2262

***

### ariaRowSpan

> **ariaRowSpan**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaRowSpan)

#### Inherited from

HTMLElement.ariaRowSpan

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2264

***

### ariaSelected

> **ariaSelected**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaSelected)

#### Inherited from

HTMLElement.ariaSelected

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2266

***

### ariaSetSize

> **ariaSetSize**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaSetSize)

#### Inherited from

HTMLElement.ariaSetSize

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2268

***

### ariaSort

> **ariaSort**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaSort)

#### Inherited from

HTMLElement.ariaSort

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2270

***

### ariaValueMax

> **ariaValueMax**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaValueMax)

#### Inherited from

HTMLElement.ariaValueMax

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2272

***

### ariaValueMin

> **ariaValueMin**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaValueMin)

#### Inherited from

HTMLElement.ariaValueMin

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2274

***

### ariaValueNow

> **ariaValueNow**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaValueNow)

#### Inherited from

HTMLElement.ariaValueNow

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2276

***

### ariaValueText

> **ariaValueText**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/ariaValueText)

#### Inherited from

HTMLElement.ariaValueText

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2278

***

### assignedSlot

> **`readonly`** **assignedSlot**: `HTMLSlotElement`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/assignedSlot)

#### Inherited from

HTMLElement.assignedSlot

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:21294

***

### attributeStyleMap

> **`readonly`** **attributeStyleMap**: `StylePropertyMap`

#### Inherited from

HTMLElement.attributeStyleMap

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7853

***

### attributes

> **`readonly`** **attributes**: `NamedNodeMap`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/attributes)

#### Inherited from

HTMLElement.attributes

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7598

***

### autocapitalize

> **autocapitalize**: `string`

#### Inherited from

HTMLElement.autocapitalize

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:10054

***

### autofocus

> **autofocus**: `boolean`

#### Inherited from

HTMLElement.autofocus

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:12043

***

### baseURI

> **`readonly`** **baseURI**: `string`

Returns node's node document's document base URL.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/baseURI)

#### Inherited from

HTMLElement.baseURI

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16072

***

### childElementCount

> **`readonly`** **childElementCount**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Document/childElementCount)

#### Inherited from

HTMLElement.childElementCount

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16761

***

### childNodes

> **`readonly`** **childNodes**: `NodeListOf`\<`ChildNode`\>

Returns the children.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/childNodes)

#### Inherited from

HTMLElement.childNodes

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16078

***

### children

> **`readonly`** **children**: `HTMLCollection`

Returns the child elements.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Document/children)

#### Inherited from

HTMLElement.children

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16767

***

### classList

> **`readonly`** **classList**: `DOMTokenList`

Allows for manipulation of element's class content attribute as a set of whitespace-separated tokens through a DOMTokenList object.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/classList)

#### Inherited from

HTMLElement.classList

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7604

***

### className

> **className**: `string`

Returns the value of element's class content attribute. Can be set to change it.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/className)

#### Inherited from

HTMLElement.className

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7610

***

### clientHeight

> **`readonly`** **clientHeight**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/clientHeight)

#### Inherited from

HTMLElement.clientHeight

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7612

***

### clientLeft

> **`readonly`** **clientLeft**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/clientLeft)

#### Inherited from

HTMLElement.clientLeft

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7614

***

### clientTop

> **`readonly`** **clientTop**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/clientTop)

#### Inherited from

HTMLElement.clientTop

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7616

***

### clientWidth

> **`readonly`** **clientWidth**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/clientWidth)

#### Inherited from

HTMLElement.clientWidth

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7618

***

### contentEditable

> **contentEditable**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/contentEditable)

#### Inherited from

HTMLElement.contentEditable

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7860

***

### dataset

> **`readonly`** **dataset**: `DOMStringMap`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/dataset)

#### Inherited from

HTMLElement.dataset

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:12045

***

### dir

> **dir**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/dir)

#### Inherited from

HTMLElement.dir

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:10056

***

### draggable

> **draggable**: `boolean`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/draggable)

#### Inherited from

HTMLElement.draggable

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:10058

***

### enterKeyHint

> **enterKeyHint**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/enterKeyHint)

#### Inherited from

HTMLElement.enterKeyHint

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7862

***

### firstChild

> **`readonly`** **firstChild**: `ChildNode`

Returns the first child.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/firstChild)

#### Inherited from

HTMLElement.firstChild

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16084

***

### firstElementChild

> **`readonly`** **firstElementChild**: `Element`

Returns the first child that is an element, and null otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Document/firstElementChild)

#### Inherited from

HTMLElement.firstElementChild

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16773

***

### hidden

> **hidden**: `boolean`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/hidden)

#### Inherited from

HTMLElement.hidden

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:10060

***

### id

> **id**: `string`

Returns the value of element's id content attribute. Can be set to change it.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/id)

#### Inherited from

HTMLElement.id

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7624

***

### inert

> **inert**: `boolean`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/inert)

#### Inherited from

HTMLElement.inert

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:10062

***

### innerHTML

> **innerHTML**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/innerHTML)

#### Inherited from

HTMLElement.innerHTML

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:14277

***

### innerText

> **innerText**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/innerText)

#### Inherited from

HTMLElement.innerText

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:10064

***

### inputMode

> **inputMode**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/inputMode)

#### Inherited from

HTMLElement.inputMode

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7864

***

### internals\_

> **internals\_**: `ElementInternals`

#### Source

[libs/component/src/types.ts:36](https://github.com/plaited/plaited/blob/317e868/libs/component/src/types.ts#L36)

***

### isConnected

> **`readonly`** **isConnected**: `boolean`

Returns true if node is connected and false otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/isConnected)

#### Inherited from

HTMLElement.isConnected

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16090

***

### isContentEditable

> **`readonly`** **isContentEditable**: `boolean`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/isContentEditable)

#### Inherited from

HTMLElement.isContentEditable

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7866

***

### lang

> **lang**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/lang)

#### Inherited from

HTMLElement.lang

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:10066

***

### lastChild

> **`readonly`** **lastChild**: `ChildNode`

Returns the last child.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/lastChild)

#### Inherited from

HTMLElement.lastChild

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16096

***

### lastElementChild

> **`readonly`** **lastElementChild**: `Element`

Returns the last child that is an element, and null otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Document/lastElementChild)

#### Inherited from

HTMLElement.lastElementChild

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16779

***

### localName

> **`readonly`** **localName**: `string`

Returns the local name.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/localName)

#### Inherited from

HTMLElement.localName

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7630

***

### namespaceURI

> **`readonly`** **namespaceURI**: `string`

Returns the namespace.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/namespaceURI)

#### Inherited from

HTMLElement.namespaceURI

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7636

***

### nextElementSibling

> **`readonly`** **nextElementSibling**: `Element`

Returns the first following sibling that is an element, and null otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/CharacterData/nextElementSibling)

#### Inherited from

HTMLElement.nextElementSibling

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16352

***

### nextSibling

> **`readonly`** **nextSibling**: `ChildNode`

Returns the next sibling.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/nextSibling)

#### Inherited from

HTMLElement.nextSibling

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16102

***

### nodeName

> **`readonly`** **nodeName**: `string`

Returns a string appropriate for the type of node.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/nodeName)

#### Inherited from

HTMLElement.nodeName

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16108

***

### nodeType

> **`readonly`** **nodeType**: `number`

Returns the type of node.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/nodeType)

#### Inherited from

HTMLElement.nodeType

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16114

***

### nodeValue

> **nodeValue**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/nodeValue)

#### Inherited from

HTMLElement.nodeValue

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16116

***

### nonce

> **nonce**?: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/nonce)

#### Inherited from

HTMLElement.nonce

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:12047

***

### offsetHeight

> **`readonly`** **offsetHeight**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/offsetHeight)

#### Inherited from

HTMLElement.offsetHeight

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:10068

***

### offsetLeft

> **`readonly`** **offsetLeft**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/offsetLeft)

#### Inherited from

HTMLElement.offsetLeft

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:10070

***

### offsetParent

> **`readonly`** **offsetParent**: `Element`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/offsetParent)

#### Inherited from

HTMLElement.offsetParent

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:10072

***

### offsetTop

> **`readonly`** **offsetTop**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/offsetTop)

#### Inherited from

HTMLElement.offsetTop

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:10074

***

### offsetWidth

> **`readonly`** **offsetWidth**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/offsetWidth)

#### Inherited from

HTMLElement.offsetWidth

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:10076

***

### onabort

> **onabort**: (`this`, `ev`) => `any`

Fires when the user aborts the download.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `UIEvent`

The event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/abort_event)

#### Returns

`any`

#### Inherited from

HTMLElement.onabort

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:8946

***

### onanimationcancel

> **onanimationcancel**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/animationcancel_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `AnimationEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.onanimationcancel

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:8948

***

### onanimationend

> **onanimationend**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/animationend_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `AnimationEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.onanimationend

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:8950

***

### onanimationiteration

> **onanimationiteration**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/animationiteration_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `AnimationEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.onanimationiteration

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:8952

***

### onanimationstart

> **onanimationstart**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/animationstart_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `AnimationEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.onanimationstart

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:8954

***

### onauxclick

> **onauxclick**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/auxclick_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `MouseEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.onauxclick

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:8956

***

### onbeforeinput

> **onbeforeinput**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/beforeinput_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `InputEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.onbeforeinput

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:8958

***

### onblur

> **onblur**: (`this`, `ev`) => `any`

Fires when the object loses the input focus.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `FocusEvent`

The focus event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/blur_event)

#### Returns

`any`

#### Inherited from

HTMLElement.onblur

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:8965

***

### oncancel

> **oncancel**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLDialogElement/cancel_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

#### Returns

`any`

#### Inherited from

HTMLElement.oncancel

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:8967

***

### oncanplay

> **oncanplay**: (`this`, `ev`) => `any`

Occurs when playback is possible, but would require further buffering.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

The event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/canplay_event)

#### Returns

`any`

#### Inherited from

HTMLElement.oncanplay

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:8974

***

### oncanplaythrough

> **oncanplaythrough**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/canplaythrough_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

#### Returns

`any`

#### Inherited from

HTMLElement.oncanplaythrough

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:8976

***

### onchange

> **onchange**: (`this`, `ev`) => `any`

Fires when the contents of the object or selection have changed.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

The event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/change_event)

#### Returns

`any`

#### Inherited from

HTMLElement.onchange

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:8983

***

### onclick

> **onclick**: (`this`, `ev`) => `any`

Fires when the user clicks the left mouse button on the object

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `MouseEvent`

The mouse event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/click_event)

#### Returns

`any`

#### Inherited from

HTMLElement.onclick

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:8990

***

### onclose

> **onclose**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLDialogElement/close_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

#### Returns

`any`

#### Inherited from

HTMLElement.onclose

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:8992

***

### oncontextmenu

> **oncontextmenu**: (`this`, `ev`) => `any`

Fires when the user clicks the right mouse button in the client area, opening the context menu.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `MouseEvent`

The mouse event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/contextmenu_event)

#### Returns

`any`

#### Inherited from

HTMLElement.oncontextmenu

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:8999

***

### oncopy

> **oncopy**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/copy_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `ClipboardEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.oncopy

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9001

***

### oncuechange

> **oncuechange**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLTrackElement/cuechange_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

#### Returns

`any`

#### Inherited from

HTMLElement.oncuechange

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9003

***

### oncut

> **oncut**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/cut_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `ClipboardEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.oncut

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9005

***

### ondblclick

> **ondblclick**: (`this`, `ev`) => `any`

Fires when the user double-clicks the object.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `MouseEvent`

The mouse event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/dblclick_event)

#### Returns

`any`

#### Inherited from

HTMLElement.ondblclick

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9012

***

### ondrag

> **ondrag**: (`this`, `ev`) => `any`

Fires on the source object continuously during a drag operation.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `DragEvent`

The event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/drag_event)

#### Returns

`any`

#### Inherited from

HTMLElement.ondrag

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9019

***

### ondragend

> **ondragend**: (`this`, `ev`) => `any`

Fires on the source object when the user releases the mouse at the close of a drag operation.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `DragEvent`

The event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/dragend_event)

#### Returns

`any`

#### Inherited from

HTMLElement.ondragend

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9026

***

### ondragenter

> **ondragenter**: (`this`, `ev`) => `any`

Fires on the target element when the user drags the object to a valid drop target.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `DragEvent`

The drag event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/dragenter_event)

#### Returns

`any`

#### Inherited from

HTMLElement.ondragenter

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9033

***

### ondragleave

> **ondragleave**: (`this`, `ev`) => `any`

Fires on the target object when the user moves the mouse out of a valid drop target during a drag operation.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `DragEvent`

The drag event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/dragleave_event)

#### Returns

`any`

#### Inherited from

HTMLElement.ondragleave

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9040

***

### ondragover

> **ondragover**: (`this`, `ev`) => `any`

Fires on the target element continuously while the user drags the object over a valid drop target.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `DragEvent`

The event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/dragover_event)

#### Returns

`any`

#### Inherited from

HTMLElement.ondragover

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9047

***

### ondragstart

> **ondragstart**: (`this`, `ev`) => `any`

Fires on the source object when the user starts to drag a text selection or selected object.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `DragEvent`

The event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/dragstart_event)

#### Returns

`any`

#### Inherited from

HTMLElement.ondragstart

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9054

***

### ondrop

> **ondrop**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/drop_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `DragEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.ondrop

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9056

***

### ondurationchange

> **ondurationchange**: (`this`, `ev`) => `any`

Occurs when the duration attribute is updated.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

The event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/durationchange_event)

#### Returns

`any`

#### Inherited from

HTMLElement.ondurationchange

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9063

***

### onemptied

> **onemptied**: (`this`, `ev`) => `any`

Occurs when the media element is reset to its initial state.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

The event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/emptied_event)

#### Returns

`any`

#### Inherited from

HTMLElement.onemptied

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9070

***

### onended

> **onended**: (`this`, `ev`) => `any`

Occurs when the end of playback is reached.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

The event

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/ended_event)

#### Returns

`any`

#### Inherited from

HTMLElement.onended

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9077

***

### onerror

> **onerror**: `OnErrorEventHandlerNonNull`

Fires when an error occurs during object loading.

#### Param

The event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/error_event)

#### Inherited from

HTMLElement.onerror

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9084

***

### onfocus

> **onfocus**: (`this`, `ev`) => `any`

Fires when the object receives focus.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `FocusEvent`

The event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/focus_event)

#### Returns

`any`

#### Inherited from

HTMLElement.onfocus

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9091

***

### onformdata

> **onformdata**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLFormElement/formdata_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `FormDataEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.onformdata

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9093

***

### onfullscreenchange

> **onfullscreenchange**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/fullscreenchange_event)

#### Parameters

▪ **this**: `Element`

▪ **ev**: `Event`

#### Returns

`any`

#### Inherited from

HTMLElement.onfullscreenchange

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7638

***

### onfullscreenerror

> **onfullscreenerror**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/fullscreenerror_event)

#### Parameters

▪ **this**: `Element`

▪ **ev**: `Event`

#### Returns

`any`

#### Inherited from

HTMLElement.onfullscreenerror

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7640

***

### ongotpointercapture

> **ongotpointercapture**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/gotpointercapture_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `PointerEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.ongotpointercapture

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9095

***

### oninput

> **oninput**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/input_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

#### Returns

`any`

#### Inherited from

HTMLElement.oninput

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9097

***

### oninvalid

> **oninvalid**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLInputElement/invalid_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

#### Returns

`any`

#### Inherited from

HTMLElement.oninvalid

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9099

***

### onkeydown

> **onkeydown**: (`this`, `ev`) => `any`

Fires when the user presses a key.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `KeyboardEvent`

The keyboard event

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/keydown_event)

#### Returns

`any`

#### Inherited from

HTMLElement.onkeydown

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9106

***

### onkeypress

> **onkeypress**: (`this`, `ev`) => `any`

Fires when the user presses an alphanumeric key.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `KeyboardEvent`

The event.

#### Returns

`any`

#### Deprecated

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/keypress_event)

#### Inherited from

HTMLElement.onkeypress

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9114

***

### onkeyup

> **onkeyup**: (`this`, `ev`) => `any`

Fires when the user releases a key.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `KeyboardEvent`

The keyboard event

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/keyup_event)

#### Returns

`any`

#### Inherited from

HTMLElement.onkeyup

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9121

***

### onload

> **onload**: (`this`, `ev`) => `any`

Fires immediately after the browser loads the object.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

The event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/SVGElement/load_event)

#### Returns

`any`

#### Inherited from

HTMLElement.onload

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9128

***

### onloadeddata

> **onloadeddata**: (`this`, `ev`) => `any`

Occurs when media data is loaded at the current playback position.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

The event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/loadeddata_event)

#### Returns

`any`

#### Inherited from

HTMLElement.onloadeddata

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9135

***

### onloadedmetadata

> **onloadedmetadata**: (`this`, `ev`) => `any`

Occurs when the duration and dimensions of the media have been determined.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

The event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/loadedmetadata_event)

#### Returns

`any`

#### Inherited from

HTMLElement.onloadedmetadata

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9142

***

### onloadstart

> **onloadstart**: (`this`, `ev`) => `any`

Occurs when Internet Explorer begins looking for media data.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

The event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/loadstart_event)

#### Returns

`any`

#### Inherited from

HTMLElement.onloadstart

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9149

***

### onlostpointercapture

> **onlostpointercapture**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Document/lostpointercapture_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `PointerEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.onlostpointercapture

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9151

***

### onmousedown

> **onmousedown**: (`this`, `ev`) => `any`

Fires when the user clicks the object with either mouse button.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `MouseEvent`

The mouse event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/mousedown_event)

#### Returns

`any`

#### Inherited from

HTMLElement.onmousedown

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9158

***

### onmouseenter

> **onmouseenter**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/mouseenter_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `MouseEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.onmouseenter

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9160

***

### onmouseleave

> **onmouseleave**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/mouseleave_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `MouseEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.onmouseleave

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9162

***

### onmousemove

> **onmousemove**: (`this`, `ev`) => `any`

Fires when the user moves the mouse over the object.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `MouseEvent`

The mouse event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/mousemove_event)

#### Returns

`any`

#### Inherited from

HTMLElement.onmousemove

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9169

***

### onmouseout

> **onmouseout**: (`this`, `ev`) => `any`

Fires when the user moves the mouse pointer outside the boundaries of the object.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `MouseEvent`

The mouse event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/mouseout_event)

#### Returns

`any`

#### Inherited from

HTMLElement.onmouseout

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9176

***

### onmouseover

> **onmouseover**: (`this`, `ev`) => `any`

Fires when the user moves the mouse pointer into the object.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `MouseEvent`

The mouse event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/mouseover_event)

#### Returns

`any`

#### Inherited from

HTMLElement.onmouseover

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9183

***

### onmouseup

> **onmouseup**: (`this`, `ev`) => `any`

Fires when the user releases a mouse button while the mouse is over the object.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `MouseEvent`

The mouse event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/mouseup_event)

#### Returns

`any`

#### Inherited from

HTMLElement.onmouseup

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9190

***

### onpaste

> **onpaste**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/paste_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `ClipboardEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.onpaste

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9192

***

### onpause

> **onpause**: (`this`, `ev`) => `any`

Occurs when playback is paused.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

The event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/pause_event)

#### Returns

`any`

#### Inherited from

HTMLElement.onpause

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9199

***

### onplay

> **onplay**: (`this`, `ev`) => `any`

Occurs when the play method is requested.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

The event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/play_event)

#### Returns

`any`

#### Inherited from

HTMLElement.onplay

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9206

***

### onplaying

> **onplaying**: (`this`, `ev`) => `any`

Occurs when the audio or video has started playing.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

The event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/playing_event)

#### Returns

`any`

#### Inherited from

HTMLElement.onplaying

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9213

***

### onpointercancel

> **onpointercancel**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/pointercancel_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `PointerEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.onpointercancel

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9215

***

### onpointerdown

> **onpointerdown**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/pointerdown_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `PointerEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.onpointerdown

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9217

***

### onpointerenter

> **onpointerenter**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/pointerenter_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `PointerEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.onpointerenter

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9219

***

### onpointerleave

> **onpointerleave**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/pointerleave_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `PointerEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.onpointerleave

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9221

***

### onpointermove

> **onpointermove**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/pointermove_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `PointerEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.onpointermove

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9223

***

### onpointerout

> **onpointerout**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/pointerout_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `PointerEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.onpointerout

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9225

***

### onpointerover

> **onpointerover**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/pointerover_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `PointerEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.onpointerover

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9227

***

### onpointerup

> **onpointerup**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/pointerup_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `PointerEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.onpointerup

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9229

***

### onprogress

> **onprogress**: (`this`, `ev`) => `any`

Occurs to indicate progress while downloading media data.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `ProgressEvent`\<`EventTarget`\>

The event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/progress_event)

#### Returns

`any`

#### Inherited from

HTMLElement.onprogress

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9236

***

### onratechange

> **onratechange**: (`this`, `ev`) => `any`

Occurs when the playback rate is increased or decreased.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

The event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/ratechange_event)

#### Returns

`any`

#### Inherited from

HTMLElement.onratechange

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9243

***

### onreset

> **onreset**: (`this`, `ev`) => `any`

Fires when the user resets a form.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

The event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLFormElement/reset_event)

#### Returns

`any`

#### Inherited from

HTMLElement.onreset

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9250

***

### onresize

> **onresize**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLVideoElement/resize_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `UIEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.onresize

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9252

***

### onscroll

> **onscroll**: (`this`, `ev`) => `any`

Fires when the user repositions the scroll box in the scroll bar on the object.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

The event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Document/scroll_event)

#### Returns

`any`

#### Inherited from

HTMLElement.onscroll

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9259

***

### onscrollend

> **onscrollend**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Document/scrollend_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

#### Returns

`any`

#### Inherited from

HTMLElement.onscrollend

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9261

***

### onsecuritypolicyviolation

> **onsecuritypolicyviolation**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Document/securitypolicyviolation_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `SecurityPolicyViolationEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.onsecuritypolicyviolation

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9263

***

### onseeked

> **onseeked**: (`this`, `ev`) => `any`

Occurs when the seek operation ends.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

The event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/seeked_event)

#### Returns

`any`

#### Inherited from

HTMLElement.onseeked

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9270

***

### onseeking

> **onseeking**: (`this`, `ev`) => `any`

Occurs when the current playback position is moved.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

The event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/seeking_event)

#### Returns

`any`

#### Inherited from

HTMLElement.onseeking

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9277

***

### onselect

> **onselect**: (`this`, `ev`) => `any`

Fires when the current selection changes.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

The event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLInputElement/select_event)

#### Returns

`any`

#### Inherited from

HTMLElement.onselect

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9284

***

### onselectionchange

> **onselectionchange**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Document/selectionchange_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

#### Returns

`any`

#### Inherited from

HTMLElement.onselectionchange

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9286

***

### onselectstart

> **onselectstart**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/selectstart_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

#### Returns

`any`

#### Inherited from

HTMLElement.onselectstart

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9288

***

### onslotchange

> **onslotchange**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLSlotElement/slotchange_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

#### Returns

`any`

#### Inherited from

HTMLElement.onslotchange

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9290

***

### onstalled

> **onstalled**: (`this`, `ev`) => `any`

Occurs when the download has stopped.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

The event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/stalled_event)

#### Returns

`any`

#### Inherited from

HTMLElement.onstalled

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9297

***

### onsubmit

> **onsubmit**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLFormElement/submit_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `SubmitEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.onsubmit

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9299

***

### onsuspend

> **onsuspend**: (`this`, `ev`) => `any`

Occurs if the load operation has been intentionally halted.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

The event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/suspend_event)

#### Returns

`any`

#### Inherited from

HTMLElement.onsuspend

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9306

***

### ontimeupdate

> **ontimeupdate**: (`this`, `ev`) => `any`

Occurs to indicate the current playback position.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

The event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/timeupdate_event)

#### Returns

`any`

#### Inherited from

HTMLElement.ontimeupdate

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9313

***

### ontoggle

> **ontoggle**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLDetailsElement/toggle_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

#### Returns

`any`

#### Inherited from

HTMLElement.ontoggle

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9315

***

### ontouchcancel

> **ontouchcancel**?: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/touchcancel_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `TouchEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.ontouchcancel

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9317

***

### ontouchend

> **ontouchend**?: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/touchend_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `TouchEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.ontouchend

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9319

***

### ontouchmove

> **ontouchmove**?: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/touchmove_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `TouchEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.ontouchmove

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9321

***

### ontouchstart

> **ontouchstart**?: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/touchstart_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `TouchEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.ontouchstart

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9323

***

### ontransitioncancel

> **ontransitioncancel**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/transitioncancel_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `TransitionEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.ontransitioncancel

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9325

***

### ontransitionend

> **ontransitionend**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/transitionend_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `TransitionEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.ontransitionend

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9327

***

### ontransitionrun

> **ontransitionrun**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/transitionrun_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `TransitionEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.ontransitionrun

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9329

***

### ontransitionstart

> **ontransitionstart**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/transitionstart_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `TransitionEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.ontransitionstart

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9331

***

### onvolumechange

> **onvolumechange**: (`this`, `ev`) => `any`

Occurs when the volume is changed, or playback is muted or unmuted.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

The event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/volumechange_event)

#### Returns

`any`

#### Inherited from

HTMLElement.onvolumechange

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9338

***

### onwaiting

> **onwaiting**: (`this`, `ev`) => `any`

Occurs when playback stops because the next frame of a video resource is not available.

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

The event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/waiting_event)

#### Returns

`any`

#### Inherited from

HTMLElement.onwaiting

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9345

***

### onwebkitanimationend

> **onwebkitanimationend**: (`this`, `ev`) => `any`

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

#### Returns

`any`

#### Deprecated

This is a legacy alias of `onanimationend`.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/animationend_event)

#### Inherited from

HTMLElement.onwebkitanimationend

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9351

***

### onwebkitanimationiteration

> **onwebkitanimationiteration**: (`this`, `ev`) => `any`

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

#### Returns

`any`

#### Deprecated

This is a legacy alias of `onanimationiteration`.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/animationiteration_event)

#### Inherited from

HTMLElement.onwebkitanimationiteration

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9357

***

### onwebkitanimationstart

> **onwebkitanimationstart**: (`this`, `ev`) => `any`

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

#### Returns

`any`

#### Deprecated

This is a legacy alias of `onanimationstart`.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/animationstart_event)

#### Inherited from

HTMLElement.onwebkitanimationstart

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9363

***

### onwebkittransitionend

> **onwebkittransitionend**: (`this`, `ev`) => `any`

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `Event`

#### Returns

`any`

#### Deprecated

This is a legacy alias of `ontransitionend`.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/transitionend_event)

#### Inherited from

HTMLElement.onwebkittransitionend

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9369

***

### onwheel

> **onwheel**: (`this`, `ev`) => `any`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/wheel_event)

#### Parameters

▪ **this**: `GlobalEventHandlers`

▪ **ev**: `WheelEvent`

#### Returns

`any`

#### Inherited from

HTMLElement.onwheel

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:9371

***

### outerHTML

> **outerHTML**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/outerHTML)

#### Inherited from

HTMLElement.outerHTML

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7642

***

### outerText

> **outerText**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/outerText)

#### Inherited from

HTMLElement.outerText

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:10078

***

### ownerDocument

> **`readonly`** **ownerDocument**: `Document`

#### Inherited from

HTMLElement.ownerDocument

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7643

***

### parentElement

> **`readonly`** **parentElement**: `HTMLElement`

Returns the parent element.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/parentElement)

#### Inherited from

HTMLElement.parentElement

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16128

***

### parentNode

> **`readonly`** **parentNode**: `ParentNode`

Returns the parent.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/parentNode)

#### Inherited from

HTMLElement.parentNode

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16134

***

### part

> **`readonly`** **part**: `DOMTokenList`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/part)

#### Inherited from

HTMLElement.part

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7645

***

### popover

> **popover**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/popover)

#### Inherited from

HTMLElement.popover

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:10080

***

### prefix

> **`readonly`** **prefix**: `string`

Returns the namespace prefix.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/prefix)

#### Inherited from

HTMLElement.prefix

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7651

***

### previousElementSibling

> **`readonly`** **previousElementSibling**: `Element`

Returns the first preceding sibling that is an element, and null otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/CharacterData/previousElementSibling)

#### Inherited from

HTMLElement.previousElementSibling

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16358

***

### previousSibling

> **`readonly`** **previousSibling**: `ChildNode`

Returns the previous sibling.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/previousSibling)

#### Inherited from

HTMLElement.previousSibling

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16140

***

### role

> **role**: `string`

#### Inherited from

HTMLElement.role

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2279

***

### scrollHeight

> **`readonly`** **scrollHeight**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/scrollHeight)

#### Inherited from

HTMLElement.scrollHeight

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7653

***

### scrollLeft

> **scrollLeft**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/scrollLeft)

#### Inherited from

HTMLElement.scrollLeft

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7655

***

### scrollTop

> **scrollTop**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/scrollTop)

#### Inherited from

HTMLElement.scrollTop

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7657

***

### scrollWidth

> **`readonly`** **scrollWidth**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/scrollWidth)

#### Inherited from

HTMLElement.scrollWidth

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7659

***

### shadowRoot

> **`readonly`** **shadowRoot**: `ShadowRoot`

Returns element's shadow root, if any, and if shadow root's mode is "open", and null otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/shadowRoot)

#### Inherited from

HTMLElement.shadowRoot

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7665

***

### slot

> **slot**: `string`

Returns the value of element's slot content attribute. Can be set to change it.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/slot)

#### Inherited from

HTMLElement.slot

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7671

***

### spellcheck

> **spellcheck**: `boolean`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/spellcheck)

#### Inherited from

HTMLElement.spellcheck

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:10082

***

### style

> **`readonly`** **style**: `CSSStyleDeclaration`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/style)

#### Inherited from

HTMLElement.style

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7855

***

### tabIndex

> **tabIndex**: `number`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/tabIndex)

#### Inherited from

HTMLElement.tabIndex

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:12049

***

### tagName

> **`readonly`** **tagName**: `string`

Returns the HTML-uppercased qualified name.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/tagName)

#### Inherited from

HTMLElement.tagName

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7677

***

### textContent

> **textContent**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/textContent)

#### Inherited from

HTMLElement.textContent

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16142

***

### title

> **title**: `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/title)

#### Inherited from

HTMLElement.title

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:10084

***

### translate

> **translate**: `boolean`

#### Inherited from

HTMLElement.translate

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:10085

## Methods

### addEventListener()

#### addEventListener(type, listener, options)

> **addEventListener**\<`K`\>(`type`, `listener`, `options`?): `void`

##### Type parameters

▪ **K** extends keyof `HTMLElementEventMap`

##### Parameters

▪ **type**: `K`

▪ **listener**: (`this`, `ev`) => `any`

▪ **options?**: `boolean` \| `AddEventListenerOptions`

##### Returns

`void`

##### Inherited from

HTMLElement.addEventListener

##### Source

node\_modules/typescript/lib/lib.dom.d.ts:10096

#### addEventListener(type, listener, options)

> **addEventListener**(`type`, `listener`, `options`?): `void`

##### Parameters

▪ **type**: `string`

▪ **listener**: `EventListenerOrEventListenerObject`

▪ **options?**: `boolean` \| `AddEventListenerOptions`

##### Returns

`void`

##### Inherited from

HTMLElement.addEventListener

##### Source

node\_modules/typescript/lib/lib.dom.d.ts:10097

***

### adoptedCallback()

> **`optional`** **adoptedCallback**(): `void`

#### Returns

`void`

#### Source

[libs/component/src/types.ts:42](https://github.com/plaited/plaited/blob/317e868/libs/component/src/types.ts#L42)

***

### after()

> **after**(...`nodes`): `void`

Inserts nodes just after node, while replacing strings in nodes with equivalent Text nodes.

Throws a "HierarchyRequestError" DOMException if the constraints of the node tree are violated.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/CharacterData/after)

#### Parameters

▪ ...**nodes**: (`string` \| `Node`)[]

#### Returns

`void`

#### Inherited from

HTMLElement.after

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:5597

***

### animate()

> **animate**(`keyframes`, `options`?): `Animation`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/animate)

#### Parameters

▪ **keyframes**: `PropertyIndexedKeyframes` \| `Keyframe`[]

▪ **options?**: `number` \| `KeyframeAnimationOptions`

#### Returns

`Animation`

#### Inherited from

HTMLElement.animate

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2429

***

### append()

> **append**(...`nodes`): `void`

Inserts nodes after the last child of node, while replacing strings in nodes with equivalent Text nodes.

Throws a "HierarchyRequestError" DOMException if the constraints of the node tree are violated.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Document/append)

#### Parameters

▪ ...**nodes**: (`string` \| `Node`)[]

#### Returns

`void`

#### Inherited from

HTMLElement.append

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16787

***

### appendChild()

> **appendChild**\<`T`\>(`node`): `T`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/appendChild)

#### Type parameters

▪ **T** extends `Node`

#### Parameters

▪ **node**: `T`

#### Returns

`T`

#### Inherited from

HTMLElement.appendChild

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16144

***

### attachInternals()

> **attachInternals**(): `ElementInternals`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/attachInternals)

#### Returns

`ElementInternals`

#### Inherited from

HTMLElement.attachInternals

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:10087

***

### attachShadow()

> **attachShadow**(`init`): `ShadowRoot`

Creates a shadow root for element and returns it.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/attachShadow)

#### Parameters

▪ **init**: `ShadowRootInit`

#### Returns

`ShadowRoot`

#### Inherited from

HTMLElement.attachShadow

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7683

***

### attributeChangedCallback()

> **`optional`** **attributeChangedCallback**(`name`, `oldValue`, `newValue`): `void`

#### Parameters

▪ **name**: `string`

▪ **oldValue**: `string`

▪ **newValue**: `string`

#### Returns

`void`

#### Source

[libs/component/src/types.ts:40](https://github.com/plaited/plaited/blob/317e868/libs/component/src/types.ts#L40)

***

### before()

> **before**(...`nodes`): `void`

Inserts nodes just before node, while replacing strings in nodes with equivalent Text nodes.

Throws a "HierarchyRequestError" DOMException if the constraints of the node tree are violated.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/CharacterData/before)

#### Parameters

▪ ...**nodes**: (`string` \| `Node`)[]

#### Returns

`void`

#### Inherited from

HTMLElement.before

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:5605

***

### blur()

> **blur**(): `void`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/blur)

#### Returns

`void`

#### Inherited from

HTMLElement.blur

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:12051

***

### checkVisibility()

> **checkVisibility**(`options`?): `boolean`

#### Parameters

▪ **options?**: `CheckVisibilityOptions`

#### Returns

`boolean`

#### Inherited from

HTMLElement.checkVisibility

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7684

***

### click()

> **click**(): `void`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/click)

#### Returns

`void`

#### Inherited from

HTMLElement.click

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:10089

***

### cloneNode()

> **cloneNode**(`deep`?): `Node`

Returns a copy of node. If deep is true, the copy also includes the node's descendants.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/cloneNode)

#### Parameters

▪ **deep?**: `boolean`

#### Returns

`Node`

#### Inherited from

HTMLElement.cloneNode

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16150

***

### closest()

#### closest(selector)

> **closest**\<`K`\>(`selector`): `HTMLElementTagNameMap`\[`K`\]

Returns the first (starting at element) inclusive ancestor that matches selectors, and null otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/closest)

##### Type parameters

▪ **K** extends keyof `HTMLElementTagNameMap`

##### Parameters

▪ **selector**: `K`

##### Returns

`HTMLElementTagNameMap`\[`K`\]

##### Inherited from

HTMLElement.closest

##### Source

node\_modules/typescript/lib/lib.dom.d.ts:7690

#### closest(selector)

> **closest**\<`K`\>(`selector`): `SVGElementTagNameMap`\[`K`\]

##### Type parameters

▪ **K** extends keyof `SVGElementTagNameMap`

##### Parameters

▪ **selector**: `K`

##### Returns

`SVGElementTagNameMap`\[`K`\]

##### Inherited from

HTMLElement.closest

##### Source

node\_modules/typescript/lib/lib.dom.d.ts:7691

#### closest(selector)

> **closest**\<`K`\>(`selector`): `MathMLElementTagNameMap`\[`K`\]

##### Type parameters

▪ **K** extends keyof `MathMLElementTagNameMap`

##### Parameters

▪ **selector**: `K`

##### Returns

`MathMLElementTagNameMap`\[`K`\]

##### Inherited from

HTMLElement.closest

##### Source

node\_modules/typescript/lib/lib.dom.d.ts:7692

#### closest(selectors)

> **closest**\<`E`\>(`selectors`): `E`

##### Type parameters

▪ **E** extends `Element` = `Element`

##### Parameters

▪ **selectors**: `string`

##### Returns

`E`

##### Inherited from

HTMLElement.closest

##### Source

node\_modules/typescript/lib/lib.dom.d.ts:7693

***

### compareDocumentPosition()

> **compareDocumentPosition**(`other`): `number`

Returns a bitmask indicating the position of other relative to node.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/compareDocumentPosition)

#### Parameters

▪ **other**: `Node`

#### Returns

`number`

#### Inherited from

HTMLElement.compareDocumentPosition

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16156

***

### computedStyleMap()

> **computedStyleMap**(): `StylePropertyMapReadOnly`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/computedStyleMap)

#### Returns

`StylePropertyMapReadOnly`

#### Inherited from

HTMLElement.computedStyleMap

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7695

***

### connectedCallback()

> **`optional`** **connectedCallback**(): `void`

#### Returns

`void`

#### Source

[libs/component/src/types.ts:39](https://github.com/plaited/plaited/blob/317e868/libs/component/src/types.ts#L39)

***

### contains()

> **contains**(`other`): `boolean`

Returns true if other is an inclusive descendant of node, and false otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/contains)

#### Parameters

▪ **other**: `Node`

#### Returns

`boolean`

#### Inherited from

HTMLElement.contains

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16162

***

### disconnectedCallback()

> **`optional`** **disconnectedCallback**(): `void`

#### Returns

`void`

#### Source

[libs/component/src/types.ts:41](https://github.com/plaited/plaited/blob/317e868/libs/component/src/types.ts#L41)

***

### dispatchEvent()

> **dispatchEvent**(`event`): `boolean`

Dispatches a synthetic event event to target and returns true if either event's cancelable attribute value is false or its preventDefault() method was not invoked, and false otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/EventTarget/dispatchEvent)

#### Parameters

▪ **event**: `Event`

#### Returns

`boolean`

#### Inherited from

HTMLElement.dispatchEvent

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:8215

***

### focus()

> **focus**(`options`?): `void`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/focus)

#### Parameters

▪ **options?**: `FocusOptions`

#### Returns

`void`

#### Inherited from

HTMLElement.focus

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:12053

***

### formAssociatedCallback()

> **`optional`** **formAssociatedCallback**(`form`): `void`

#### Parameters

▪ **form**: `HTMLFormElement`

#### Returns

`void`

#### Source

[libs/component/src/types.ts:43](https://github.com/plaited/plaited/blob/317e868/libs/component/src/types.ts#L43)

***

### formDisabledCallback()

> **`optional`** **formDisabledCallback**(`disabled`): `void`

#### Parameters

▪ **disabled**: `boolean`

#### Returns

`void`

#### Source

[libs/component/src/types.ts:44](https://github.com/plaited/plaited/blob/317e868/libs/component/src/types.ts#L44)

***

### formResetCallback()

> **`optional`** **formResetCallback**(): `void`

#### Returns

`void`

#### Source

[libs/component/src/types.ts:45](https://github.com/plaited/plaited/blob/317e868/libs/component/src/types.ts#L45)

***

### formStateRestoreCallback()

> **`optional`** **formStateRestoreCallback**(`state`, `reason`): `void`

#### Parameters

▪ **state**: `unknown`

▪ **reason**: `"autocomplete"` \| `"restore"`

#### Returns

`void`

#### Source

[libs/component/src/types.ts:46](https://github.com/plaited/plaited/blob/317e868/libs/component/src/types.ts#L46)

***

### getAnimations()

> **getAnimations**(`options`?): `Animation`[]

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/getAnimations)

#### Parameters

▪ **options?**: `GetAnimationsOptions`

#### Returns

`Animation`[]

#### Inherited from

HTMLElement.getAnimations

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:2431

***

### getAttribute()

> **getAttribute**(`qualifiedName`): `string`

Returns element's first attribute whose qualified name is qualifiedName, and null if there is no such attribute otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/getAttribute)

#### Parameters

▪ **qualifiedName**: `string`

#### Returns

`string`

#### Inherited from

HTMLElement.getAttribute

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7701

***

### getAttributeNS()

> **getAttributeNS**(`namespace`, `localName`): `string`

Returns element's attribute whose namespace is namespace and local name is localName, and null if there is no such attribute otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/getAttributeNS)

#### Parameters

▪ **namespace**: `string`

▪ **localName**: `string`

#### Returns

`string`

#### Inherited from

HTMLElement.getAttributeNS

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7707

***

### getAttributeNames()

> **getAttributeNames**(): `string`[]

Returns the qualified names of all element's attributes. Can contain duplicates.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/getAttributeNames)

#### Returns

`string`[]

#### Inherited from

HTMLElement.getAttributeNames

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7713

***

### getAttributeNode()

> **getAttributeNode**(`qualifiedName`): `Attr`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/getAttributeNode)

#### Parameters

▪ **qualifiedName**: `string`

#### Returns

`Attr`

#### Inherited from

HTMLElement.getAttributeNode

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7715

***

### getAttributeNodeNS()

> **getAttributeNodeNS**(`namespace`, `localName`): `Attr`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/getAttributeNodeNS)

#### Parameters

▪ **namespace**: `string`

▪ **localName**: `string`

#### Returns

`Attr`

#### Inherited from

HTMLElement.getAttributeNodeNS

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7717

***

### getBoundingClientRect()

> **getBoundingClientRect**(): `DOMRect`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/getBoundingClientRect)

#### Returns

`DOMRect`

#### Inherited from

HTMLElement.getBoundingClientRect

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7719

***

### getClientRects()

> **getClientRects**(): `DOMRectList`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/getClientRects)

#### Returns

`DOMRectList`

#### Inherited from

HTMLElement.getClientRects

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7721

***

### getElementsByClassName()

> **getElementsByClassName**(`classNames`): `HTMLCollectionOf`\<`Element`\>

Returns a HTMLCollection of the elements in the object on which the method was invoked (a document or an element) that have all the classes given by classNames. The classNames argument is interpreted as a space-separated list of classes.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/getElementsByClassName)

#### Parameters

▪ **classNames**: `string`

#### Returns

`HTMLCollectionOf`\<`Element`\>

#### Inherited from

HTMLElement.getElementsByClassName

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7727

***

### getElementsByTagName()

#### getElementsByTagName(qualifiedName)

> **getElementsByTagName**\<`K`\>(`qualifiedName`): `HTMLCollectionOf`\<`HTMLElementTagNameMap`\[`K`\]\>

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/getElementsByTagName)

##### Type parameters

▪ **K** extends keyof `HTMLElementTagNameMap`

##### Parameters

▪ **qualifiedName**: `K`

##### Returns

`HTMLCollectionOf`\<`HTMLElementTagNameMap`\[`K`\]\>

##### Inherited from

HTMLElement.getElementsByTagName

##### Source

node\_modules/typescript/lib/lib.dom.d.ts:7729

#### getElementsByTagName(qualifiedName)

> **getElementsByTagName**\<`K`\>(`qualifiedName`): `HTMLCollectionOf`\<`SVGElementTagNameMap`\[`K`\]\>

##### Type parameters

▪ **K** extends keyof `SVGElementTagNameMap`

##### Parameters

▪ **qualifiedName**: `K`

##### Returns

`HTMLCollectionOf`\<`SVGElementTagNameMap`\[`K`\]\>

##### Inherited from

HTMLElement.getElementsByTagName

##### Source

node\_modules/typescript/lib/lib.dom.d.ts:7730

#### getElementsByTagName(qualifiedName)

> **getElementsByTagName**\<`K`\>(`qualifiedName`): `HTMLCollectionOf`\<`MathMLElementTagNameMap`\[`K`\]\>

##### Type parameters

▪ **K** extends keyof `MathMLElementTagNameMap`

##### Parameters

▪ **qualifiedName**: `K`

##### Returns

`HTMLCollectionOf`\<`MathMLElementTagNameMap`\[`K`\]\>

##### Inherited from

HTMLElement.getElementsByTagName

##### Source

node\_modules/typescript/lib/lib.dom.d.ts:7731

#### getElementsByTagName(qualifiedName)

> **getElementsByTagName**\<`K`\>(`qualifiedName`): `HTMLCollectionOf`\<`HTMLElementDeprecatedTagNameMap`\[`K`\]\>

##### Type parameters

▪ **K** extends keyof `HTMLElementDeprecatedTagNameMap`

##### Parameters

▪ **qualifiedName**: `K`

##### Returns

`HTMLCollectionOf`\<`HTMLElementDeprecatedTagNameMap`\[`K`\]\>

##### Inherited from

HTMLElement.getElementsByTagName

##### Deprecated

##### Source

node\_modules/typescript/lib/lib.dom.d.ts:7733

#### getElementsByTagName(qualifiedName)

> **getElementsByTagName**(`qualifiedName`): `HTMLCollectionOf`\<`Element`\>

##### Parameters

▪ **qualifiedName**: `string`

##### Returns

`HTMLCollectionOf`\<`Element`\>

##### Inherited from

HTMLElement.getElementsByTagName

##### Source

node\_modules/typescript/lib/lib.dom.d.ts:7734

***

### getElementsByTagNameNS()

#### getElementsByTagNameNS(namespaceURI, localName)

> **getElementsByTagNameNS**(`namespaceURI`, `localName`): `HTMLCollectionOf`\<`HTMLElement`\>

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/getElementsByTagNameNS)

##### Parameters

▪ **namespaceURI**: `"http://www.w3.org/1999/xhtml"`

▪ **localName**: `string`

##### Returns

`HTMLCollectionOf`\<`HTMLElement`\>

##### Inherited from

HTMLElement.getElementsByTagNameNS

##### Source

node\_modules/typescript/lib/lib.dom.d.ts:7736

#### getElementsByTagNameNS(namespaceURI, localName)

> **getElementsByTagNameNS**(`namespaceURI`, `localName`): `HTMLCollectionOf`\<`SVGElement`\>

##### Parameters

▪ **namespaceURI**: `"http://www.w3.org/2000/svg"`

▪ **localName**: `string`

##### Returns

`HTMLCollectionOf`\<`SVGElement`\>

##### Inherited from

HTMLElement.getElementsByTagNameNS

##### Source

node\_modules/typescript/lib/lib.dom.d.ts:7737

#### getElementsByTagNameNS(namespaceURI, localName)

> **getElementsByTagNameNS**(`namespaceURI`, `localName`): `HTMLCollectionOf`\<`MathMLElement`\>

##### Parameters

▪ **namespaceURI**: `"http://www.w3.org/1998/Math/MathML"`

▪ **localName**: `string`

##### Returns

`HTMLCollectionOf`\<`MathMLElement`\>

##### Inherited from

HTMLElement.getElementsByTagNameNS

##### Source

node\_modules/typescript/lib/lib.dom.d.ts:7738

#### getElementsByTagNameNS(namespace, localName)

> **getElementsByTagNameNS**(`namespace`, `localName`): `HTMLCollectionOf`\<`Element`\>

##### Parameters

▪ **namespace**: `string`

▪ **localName**: `string`

##### Returns

`HTMLCollectionOf`\<`Element`\>

##### Inherited from

HTMLElement.getElementsByTagNameNS

##### Source

node\_modules/typescript/lib/lib.dom.d.ts:7739

***

### getRootNode()

> **getRootNode**(`options`?): `Node`

Returns node's root.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/getRootNode)

#### Parameters

▪ **options?**: `GetRootNodeOptions`

#### Returns

`Node`

#### Inherited from

HTMLElement.getRootNode

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16168

***

### hasAttribute()

> **hasAttribute**(`qualifiedName`): `boolean`

Returns true if element has an attribute whose qualified name is qualifiedName, and false otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/hasAttribute)

#### Parameters

▪ **qualifiedName**: `string`

#### Returns

`boolean`

#### Inherited from

HTMLElement.hasAttribute

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7745

***

### hasAttributeNS()

> **hasAttributeNS**(`namespace`, `localName`): `boolean`

Returns true if element has an attribute whose namespace is namespace and local name is localName.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/hasAttributeNS)

#### Parameters

▪ **namespace**: `string`

▪ **localName**: `string`

#### Returns

`boolean`

#### Inherited from

HTMLElement.hasAttributeNS

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7751

***

### hasAttributes()

> **hasAttributes**(): `boolean`

Returns true if element has attributes, and false otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/hasAttributes)

#### Returns

`boolean`

#### Inherited from

HTMLElement.hasAttributes

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7757

***

### hasChildNodes()

> **hasChildNodes**(): `boolean`

Returns whether node has children.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/hasChildNodes)

#### Returns

`boolean`

#### Inherited from

HTMLElement.hasChildNodes

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16174

***

### hasPointerCapture()

> **hasPointerCapture**(`pointerId`): `boolean`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/hasPointerCapture)

#### Parameters

▪ **pointerId**: `number`

#### Returns

`boolean`

#### Inherited from

HTMLElement.hasPointerCapture

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7759

***

### hidePopover()

> **hidePopover**(): `void`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/hidePopover)

#### Returns

`void`

#### Inherited from

HTMLElement.hidePopover

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:10091

***

### insertAdjacentElement()

> **insertAdjacentElement**(`where`, `element`): `Element`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/insertAdjacentElement)

#### Parameters

▪ **where**: `InsertPosition`

▪ **element**: `Element`

#### Returns

`Element`

#### Inherited from

HTMLElement.insertAdjacentElement

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7761

***

### insertAdjacentHTML()

> **insertAdjacentHTML**(`position`, `text`): `void`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/insertAdjacentHTML)

#### Parameters

▪ **position**: `InsertPosition`

▪ **text**: `string`

#### Returns

`void`

#### Inherited from

HTMLElement.insertAdjacentHTML

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7763

***

### insertAdjacentText()

> **insertAdjacentText**(`where`, `data`): `void`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/insertAdjacentText)

#### Parameters

▪ **where**: `InsertPosition`

▪ **data**: `string`

#### Returns

`void`

#### Inherited from

HTMLElement.insertAdjacentText

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7765

***

### insertBefore()

> **insertBefore**\<`T`\>(`node`, `child`): `T`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/insertBefore)

#### Type parameters

▪ **T** extends `Node`

#### Parameters

▪ **node**: `T`

▪ **child**: `Node`

#### Returns

`T`

#### Inherited from

HTMLElement.insertBefore

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16176

***

### isDefaultNamespace()

> **isDefaultNamespace**(`namespace`): `boolean`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/isDefaultNamespace)

#### Parameters

▪ **namespace**: `string`

#### Returns

`boolean`

#### Inherited from

HTMLElement.isDefaultNamespace

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16178

***

### isEqualNode()

> **isEqualNode**(`otherNode`): `boolean`

Returns whether node and otherNode have the same properties.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/isEqualNode)

#### Parameters

▪ **otherNode**: `Node`

#### Returns

`boolean`

#### Inherited from

HTMLElement.isEqualNode

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16184

***

### isSameNode()

> **isSameNode**(`otherNode`): `boolean`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/isSameNode)

#### Parameters

▪ **otherNode**: `Node`

#### Returns

`boolean`

#### Inherited from

HTMLElement.isSameNode

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16186

***

### lookupNamespaceURI()

> **lookupNamespaceURI**(`prefix`): `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/lookupNamespaceURI)

#### Parameters

▪ **prefix**: `string`

#### Returns

`string`

#### Inherited from

HTMLElement.lookupNamespaceURI

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16188

***

### lookupPrefix()

> **lookupPrefix**(`namespace`): `string`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/lookupPrefix)

#### Parameters

▪ **namespace**: `string`

#### Returns

`string`

#### Inherited from

HTMLElement.lookupPrefix

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16190

***

### matches()

> **matches**(`selectors`): `boolean`

Returns true if matching selectors against element's root yields element, and false otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/matches)

#### Parameters

▪ **selectors**: `string`

#### Returns

`boolean`

#### Inherited from

HTMLElement.matches

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7771

***

### normalize()

> **normalize**(): `void`

Removes empty exclusive Text nodes and concatenates the data of remaining contiguous exclusive Text nodes into the first of their nodes.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/normalize)

#### Returns

`void`

#### Inherited from

HTMLElement.normalize

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16196

***

### plait()

> **`optional`** **plait**(`props`): `void` \| `Promise`\<`void`\>

#### Parameters

▪ **props**: [`PlaitProps`](../type-aliases/PlaitProps.md)

#### Returns

`void` \| `Promise`\<`void`\>

#### Source

[libs/component/src/types.ts:37](https://github.com/plaited/plaited/blob/317e868/libs/component/src/types.ts#L37)

***

### prepend()

> **prepend**(...`nodes`): `void`

Inserts nodes before the first child of node, while replacing strings in nodes with equivalent Text nodes.

Throws a "HierarchyRequestError" DOMException if the constraints of the node tree are violated.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Document/prepend)

#### Parameters

▪ ...**nodes**: (`string` \| `Node`)[]

#### Returns

`void`

#### Inherited from

HTMLElement.prepend

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16795

***

### querySelector()

#### querySelector(selectors)

> **querySelector**\<`K`\>(`selectors`): `HTMLElementTagNameMap`\[`K`\]

Returns the first element that is a descendant of node that matches selectors.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Document/querySelector)

##### Type parameters

▪ **K** extends keyof `HTMLElementTagNameMap`

##### Parameters

▪ **selectors**: `K`

##### Returns

`HTMLElementTagNameMap`\[`K`\]

##### Inherited from

HTMLElement.querySelector

##### Source

node\_modules/typescript/lib/lib.dom.d.ts:16801

#### querySelector(selectors)

> **querySelector**\<`K`\>(`selectors`): `SVGElementTagNameMap`\[`K`\]

##### Type parameters

▪ **K** extends keyof `SVGElementTagNameMap`

##### Parameters

▪ **selectors**: `K`

##### Returns

`SVGElementTagNameMap`\[`K`\]

##### Inherited from

HTMLElement.querySelector

##### Source

node\_modules/typescript/lib/lib.dom.d.ts:16802

#### querySelector(selectors)

> **querySelector**\<`K`\>(`selectors`): `MathMLElementTagNameMap`\[`K`\]

##### Type parameters

▪ **K** extends keyof `MathMLElementTagNameMap`

##### Parameters

▪ **selectors**: `K`

##### Returns

`MathMLElementTagNameMap`\[`K`\]

##### Inherited from

HTMLElement.querySelector

##### Source

node\_modules/typescript/lib/lib.dom.d.ts:16803

#### querySelector(selectors)

> **querySelector**\<`K`\>(`selectors`): `HTMLElementDeprecatedTagNameMap`\[`K`\]

##### Type parameters

▪ **K** extends keyof `HTMLElementDeprecatedTagNameMap`

##### Parameters

▪ **selectors**: `K`

##### Returns

`HTMLElementDeprecatedTagNameMap`\[`K`\]

##### Inherited from

HTMLElement.querySelector

##### Deprecated

##### Source

node\_modules/typescript/lib/lib.dom.d.ts:16805

#### querySelector(selectors)

> **querySelector**\<`E`\>(`selectors`): `E`

##### Type parameters

▪ **E** extends `Element` = `Element`

##### Parameters

▪ **selectors**: `string`

##### Returns

`E`

##### Inherited from

HTMLElement.querySelector

##### Source

node\_modules/typescript/lib/lib.dom.d.ts:16806

***

### querySelectorAll()

#### querySelectorAll(selectors)

> **querySelectorAll**\<`K`\>(`selectors`): `NodeListOf`\<`HTMLElementTagNameMap`\[`K`\]\>

Returns all element descendants of node that match selectors.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Document/querySelectorAll)

##### Type parameters

▪ **K** extends keyof `HTMLElementTagNameMap`

##### Parameters

▪ **selectors**: `K`

##### Returns

`NodeListOf`\<`HTMLElementTagNameMap`\[`K`\]\>

##### Inherited from

HTMLElement.querySelectorAll

##### Source

node\_modules/typescript/lib/lib.dom.d.ts:16812

#### querySelectorAll(selectors)

> **querySelectorAll**\<`K`\>(`selectors`): `NodeListOf`\<`SVGElementTagNameMap`\[`K`\]\>

##### Type parameters

▪ **K** extends keyof `SVGElementTagNameMap`

##### Parameters

▪ **selectors**: `K`

##### Returns

`NodeListOf`\<`SVGElementTagNameMap`\[`K`\]\>

##### Inherited from

HTMLElement.querySelectorAll

##### Source

node\_modules/typescript/lib/lib.dom.d.ts:16813

#### querySelectorAll(selectors)

> **querySelectorAll**\<`K`\>(`selectors`): `NodeListOf`\<`MathMLElementTagNameMap`\[`K`\]\>

##### Type parameters

▪ **K** extends keyof `MathMLElementTagNameMap`

##### Parameters

▪ **selectors**: `K`

##### Returns

`NodeListOf`\<`MathMLElementTagNameMap`\[`K`\]\>

##### Inherited from

HTMLElement.querySelectorAll

##### Source

node\_modules/typescript/lib/lib.dom.d.ts:16814

#### querySelectorAll(selectors)

> **querySelectorAll**\<`K`\>(`selectors`): `NodeListOf`\<`HTMLElementDeprecatedTagNameMap`\[`K`\]\>

##### Type parameters

▪ **K** extends keyof `HTMLElementDeprecatedTagNameMap`

##### Parameters

▪ **selectors**: `K`

##### Returns

`NodeListOf`\<`HTMLElementDeprecatedTagNameMap`\[`K`\]\>

##### Inherited from

HTMLElement.querySelectorAll

##### Deprecated

##### Source

node\_modules/typescript/lib/lib.dom.d.ts:16816

#### querySelectorAll(selectors)

> **querySelectorAll**\<`E`\>(`selectors`): `NodeListOf`\<`E`\>

##### Type parameters

▪ **E** extends `Element` = `Element`

##### Parameters

▪ **selectors**: `string`

##### Returns

`NodeListOf`\<`E`\>

##### Inherited from

HTMLElement.querySelectorAll

##### Source

node\_modules/typescript/lib/lib.dom.d.ts:16817

***

### releasePointerCapture()

> **releasePointerCapture**(`pointerId`): `void`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/releasePointerCapture)

#### Parameters

▪ **pointerId**: `number`

#### Returns

`void`

#### Inherited from

HTMLElement.releasePointerCapture

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7773

***

### remove()

> **remove**(): `void`

Removes node.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/CharacterData/remove)

#### Returns

`void`

#### Inherited from

HTMLElement.remove

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:5611

***

### removeAttribute()

> **removeAttribute**(`qualifiedName`): `void`

Removes element's first attribute whose qualified name is qualifiedName.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/removeAttribute)

#### Parameters

▪ **qualifiedName**: `string`

#### Returns

`void`

#### Inherited from

HTMLElement.removeAttribute

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7779

***

### removeAttributeNS()

> **removeAttributeNS**(`namespace`, `localName`): `void`

Removes element's attribute whose namespace is namespace and local name is localName.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/removeAttributeNS)

#### Parameters

▪ **namespace**: `string`

▪ **localName**: `string`

#### Returns

`void`

#### Inherited from

HTMLElement.removeAttributeNS

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7785

***

### removeAttributeNode()

> **removeAttributeNode**(`attr`): `Attr`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/removeAttributeNode)

#### Parameters

▪ **attr**: `Attr`

#### Returns

`Attr`

#### Inherited from

HTMLElement.removeAttributeNode

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7787

***

### removeChild()

> **removeChild**\<`T`\>(`child`): `T`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/removeChild)

#### Type parameters

▪ **T** extends `Node`

#### Parameters

▪ **child**: `T`

#### Returns

`T`

#### Inherited from

HTMLElement.removeChild

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16198

***

### removeEventListener()

#### removeEventListener(type, listener, options)

> **removeEventListener**\<`K`\>(`type`, `listener`, `options`?): `void`

##### Type parameters

▪ **K** extends keyof `HTMLElementEventMap`

##### Parameters

▪ **type**: `K`

▪ **listener**: (`this`, `ev`) => `any`

▪ **options?**: `boolean` \| `EventListenerOptions`

##### Returns

`void`

##### Inherited from

HTMLElement.removeEventListener

##### Source

node\_modules/typescript/lib/lib.dom.d.ts:10098

#### removeEventListener(type, listener, options)

> **removeEventListener**(`type`, `listener`, `options`?): `void`

##### Parameters

▪ **type**: `string`

▪ **listener**: `EventListenerOrEventListenerObject`

▪ **options?**: `boolean` \| `EventListenerOptions`

##### Returns

`void`

##### Inherited from

HTMLElement.removeEventListener

##### Source

node\_modules/typescript/lib/lib.dom.d.ts:10099

***

### replaceChild()

> **replaceChild**\<`T`\>(`node`, `child`): `T`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Node/replaceChild)

#### Type parameters

▪ **T** extends `Node`

#### Parameters

▪ **node**: `Node`

▪ **child**: `T`

#### Returns

`T`

#### Inherited from

HTMLElement.replaceChild

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16200

***

### replaceChildren()

> **replaceChildren**(...`nodes`): `void`

Replace all children of node with nodes, while replacing strings in nodes with equivalent Text nodes.

Throws a "HierarchyRequestError" DOMException if the constraints of the node tree are violated.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Document/replaceChildren)

#### Parameters

▪ ...**nodes**: (`string` \| `Node`)[]

#### Returns

`void`

#### Inherited from

HTMLElement.replaceChildren

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:16825

***

### replaceWith()

> **replaceWith**(...`nodes`): `void`

Replaces node with nodes, while replacing strings in nodes with equivalent Text nodes.

Throws a "HierarchyRequestError" DOMException if the constraints of the node tree are violated.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/CharacterData/replaceWith)

#### Parameters

▪ ...**nodes**: (`string` \| `Node`)[]

#### Returns

`void`

#### Inherited from

HTMLElement.replaceWith

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:5619

***

### requestFullscreen()

> **requestFullscreen**(`options`?): `Promise`\<`void`\>

Displays element fullscreen and resolves promise when done.

When supplied, options's navigationUI member indicates whether showing navigation UI while in fullscreen is preferred or not. If set to "show", navigation simplicity is preferred over screen space, and if set to "hide", more screen space is preferred. User agents are always free to honor user preference over the application's. The default value "auto" indicates no application preference.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/requestFullscreen)

#### Parameters

▪ **options?**: `FullscreenOptions`

#### Returns

`Promise`\<`void`\>

#### Inherited from

HTMLElement.requestFullscreen

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7795

***

### requestPointerLock()

> **requestPointerLock**(): `void`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/requestPointerLock)

#### Returns

`void`

#### Inherited from

HTMLElement.requestPointerLock

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7797

***

### scroll()

#### scroll(options)

> **scroll**(`options`?): `void`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/scroll)

##### Parameters

▪ **options?**: `ScrollToOptions`

##### Returns

`void`

##### Inherited from

HTMLElement.scroll

##### Source

node\_modules/typescript/lib/lib.dom.d.ts:7799

#### scroll(x, y)

> **scroll**(`x`, `y`): `void`

##### Parameters

▪ **x**: `number`

▪ **y**: `number`

##### Returns

`void`

##### Inherited from

HTMLElement.scroll

##### Source

node\_modules/typescript/lib/lib.dom.d.ts:7800

***

### scrollBy()

#### scrollBy(options)

> **scrollBy**(`options`?): `void`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/scrollBy)

##### Parameters

▪ **options?**: `ScrollToOptions`

##### Returns

`void`

##### Inherited from

HTMLElement.scrollBy

##### Source

node\_modules/typescript/lib/lib.dom.d.ts:7802

#### scrollBy(x, y)

> **scrollBy**(`x`, `y`): `void`

##### Parameters

▪ **x**: `number`

▪ **y**: `number`

##### Returns

`void`

##### Inherited from

HTMLElement.scrollBy

##### Source

node\_modules/typescript/lib/lib.dom.d.ts:7803

***

### scrollIntoView()

> **scrollIntoView**(`arg`?): `void`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/scrollIntoView)

#### Parameters

▪ **arg?**: `boolean` \| `ScrollIntoViewOptions`

#### Returns

`void`

#### Inherited from

HTMLElement.scrollIntoView

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7805

***

### scrollTo()

#### scrollTo(options)

> **scrollTo**(`options`?): `void`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/scrollTo)

##### Parameters

▪ **options?**: `ScrollToOptions`

##### Returns

`void`

##### Inherited from

HTMLElement.scrollTo

##### Source

node\_modules/typescript/lib/lib.dom.d.ts:7807

#### scrollTo(x, y)

> **scrollTo**(`x`, `y`): `void`

##### Parameters

▪ **x**: `number`

▪ **y**: `number`

##### Returns

`void`

##### Inherited from

HTMLElement.scrollTo

##### Source

node\_modules/typescript/lib/lib.dom.d.ts:7808

***

### setAttribute()

> **setAttribute**(`qualifiedName`, `value`): `void`

Sets the value of element's first attribute whose qualified name is qualifiedName to value.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/setAttribute)

#### Parameters

▪ **qualifiedName**: `string`

▪ **value**: `string`

#### Returns

`void`

#### Inherited from

HTMLElement.setAttribute

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7814

***

### setAttributeNS()

> **setAttributeNS**(`namespace`, `qualifiedName`, `value`): `void`

Sets the value of element's attribute whose namespace is namespace and local name is localName to value.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/setAttributeNS)

#### Parameters

▪ **namespace**: `string`

▪ **qualifiedName**: `string`

▪ **value**: `string`

#### Returns

`void`

#### Inherited from

HTMLElement.setAttributeNS

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7820

***

### setAttributeNode()

> **setAttributeNode**(`attr`): `Attr`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/setAttributeNode)

#### Parameters

▪ **attr**: `Attr`

#### Returns

`Attr`

#### Inherited from

HTMLElement.setAttributeNode

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7822

***

### setAttributeNodeNS()

> **setAttributeNodeNS**(`attr`): `Attr`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/setAttributeNodeNS)

#### Parameters

▪ **attr**: `Attr`

#### Returns

`Attr`

#### Inherited from

HTMLElement.setAttributeNodeNS

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7824

***

### setPointerCapture()

> **setPointerCapture**(`pointerId`): `void`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/setPointerCapture)

#### Parameters

▪ **pointerId**: `number`

#### Returns

`void`

#### Inherited from

HTMLElement.setPointerCapture

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7826

***

### showPopover()

> **showPopover**(): `void`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/showPopover)

#### Returns

`void`

#### Inherited from

HTMLElement.showPopover

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:10093

***

### toggleAttribute()

> **toggleAttribute**(`qualifiedName`, `force`?): `boolean`

If force is not given, "toggles" qualifiedName, removing it if it is present and adding it if it is not present. If force is true, adds qualifiedName. If force is false, removes qualifiedName.

Returns true if qualifiedName is now present, and false otherwise.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/toggleAttribute)

#### Parameters

▪ **qualifiedName**: `string`

▪ **force?**: `boolean`

#### Returns

`boolean`

#### Inherited from

HTMLElement.toggleAttribute

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7834

***

### togglePopover()

> **togglePopover**(`force`?): `void`

[MDN Reference](https://developer.mozilla.org/docs/Web/API/HTMLElement/togglePopover)

#### Parameters

▪ **force?**: `boolean`

#### Returns

`void`

#### Inherited from

HTMLElement.togglePopover

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:10095

***

### webkitMatchesSelector()

> **webkitMatchesSelector**(`selectors`): `boolean`

#### Parameters

▪ **selectors**: `string`

#### Returns

`boolean`

#### Inherited from

HTMLElement.webkitMatchesSelector

#### Deprecated

This is a legacy alias of `matches`.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Element/matches)

#### Source

node\_modules/typescript/lib/lib.dom.d.ts:7840

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
