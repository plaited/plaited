# plaited

Rapidly code web interfaces as requirements change and evolve.

## Requirements

### JavaScript runtime options

1. [Node](https://nodejs.org/en) >= v18
2. Any modern evergreen browser

## Installing

`npm install --save plaited`

## Library goals

- Easily create cross framework and reusable interface components, PlaitedComponent.
- Enables native hydration and island architecture via web components and the declarative shadow dom.
- Auto Event binding via data attribute [data-trigger]
- Easy, safe, isolated(shadow dom) DOM selection, DOM rendering, and attribute CRUD via `$` helper and data attribute [data-target]
- Implicit state management via behavioral programming
- Island communication via messenger pattern
- Component SubComponent communication via [eventDispatch()](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/dispatchEvent)
- Design to allow usage of web workers in concert with islands to offload expensive processes via the messenger pattern
- Subscribe and Unsubscribe from stored data values via publisher pattern and with `useStore` utility
  manipulation
- Facilitate the usage of JSX for templating and dynamically rendering PlaitedComponents and FunctionTemplates
- Easily share and reuse styles across PlaitedComponents and FunctionTemplates via our `css` tagged template function and stylesheet hoisting built into jsx-transform

## [Docs](https://github.com/plaited/playbook)