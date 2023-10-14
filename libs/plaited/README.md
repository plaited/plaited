# plaited

Plaited is set of components and patterns for rapidly coding and refining web
application web interfaces as specifications (requirements) change and evolve.

## Requirements

### JavaScript runtime options

1. [Node](https://nodejs.org/en) >= v18
2. Any modern evergreen browser

### Recommended test tooling

- [@web/test-runner](https://www.npmjs.com/package/@web/test-runner) >= 0.16.1
- [@plaited/rite](https://www.npmjs.com/package/@plaited/rite) >= 3.0.1

## Installing

`npm install --save plaited`


## Library goals

- Enable creating reusable interface components, Plaited Elements, who's logic
  is loosely coupled to their presentation.
- Island architecture via web component and the declarative shadow dom.
- Event binding and dom selection via data attributes like stimulus js and
  catalyst js
- Implicit state management via behavioral programming
- Island communication via messenger pattern
- Using web workers in concert with islands to offload expensive processes via
  the messenger pattern
- Synchronously and asynchronously subscribing to stored data values via
  publisher pattern
- Leveraging shorthands for easy DOM selection, DOM rendering, and attribute
  manipulation
- Facilitate the usage of JSX for templating and dynamically rendering Plaited
  Elements
- Easily sharing and reusing styles across Plaited Elements (shadow dom and
  light dom)

## [Typedocs](../../playbook/api/modules/plaited.md)