# plaited

Plaited is set of components and patterns for rapidly coding and refining web
application web interfaces as specifications (requirements) change and evolve.

Plaited is designed to enable:

- Creating reusable interface components, Plaited Elements, who's logic is
  loosely coupled to their presentation.
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
