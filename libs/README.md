# plaited

This lib set serves as a workspace for working on our rendering library Plaited

## Libraries

### External usage

- [plaited](plaited/README.md): plaited library package


### Internal usage

**The following libraries are not recommended for usage outside the Plaited organization. They are dependencies for our Plaited libs and apps. These libraries are open sourced as reference implementation. Take as a dependency at your own risk.**

- [@plaited/behavioral](behavioral/README.md): implicit state management
  library using the behavioral programming algorithm
- [@plaited/component](component/README.md): createComponent ui rending utility
- [@plaited/component-types](component/README.md): typedefs for @plaited/component and @plaited/jsx
- [@plaited/jsx](jsx/README.md):
  - templating utility and types
  - css-in-js utility to enable templating utility's style hoisting pattern
  - data attribute constants for templating utility
  - server side rendering utility for templating utility
  - jsx runtime for templating utility
  - classNames utility function for conditionally joining css class names
  - stylesheets utility function for conditionally joining css-on-js utility function generated stylesheet objects
- [@plaited/utils](utils/README.md): runtime agnostic utility functions