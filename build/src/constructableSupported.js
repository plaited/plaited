let doc = false
let sheet = false
if (typeof Document !== 'undefined') {
  doc = 'adoptedStyleSheets' in Document.prototype
}
if (typeof CSSStyleSheet !== 'undefined') {
  sheet = 'replace' in CSSStyleSheet.prototype
}
export const constructableSupported = doc && sheet
