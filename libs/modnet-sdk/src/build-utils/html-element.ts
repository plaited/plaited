if (typeof global.HTMLElement === 'undefined') {
  // @ts-ignore node env
  global.HTMLElement = class HTMLElement {}
}