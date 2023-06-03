# @plaited/jsx

## JSX Runtime

This library exports the custom jsx runtime for the plaited library to be used
like so:

**example: tsconfig.json**

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@plaited/jsx"
  }
}
```

Further it ships the following ES modules which are in turn re-exported by
[plaited](https://www.npmjs.com/package/plaited) itself.

## createTemplate

This is our function for creating template object used to client side & server
side render [PlaitedElements](libs/jsx/src/types.ts). The JSX runtime makes use
of this function under the hood. It is designed to enable easy creation of
reusable html structures as well as web component structures that make use of
the
[declarative shadow dom](https://developer.chrome.com/articles/declarative-shadow-dom/).

## CSS

A custom css-in-js library designed to work with the JSX runtime.

**example: usage**

```tsx
const [ classes, stylesheet ] = css`
.button {
  height: 18px;
  width: auto;
}`

<button className={classes.button} {...stylesheet}>Click Me!</button>;
```

This may seem different from other libraries and it is. It combines css module
hashing with a new technique called stylesheet hoisting. This technique allows
you to reuse styles across reusable and feature components as necessary with the
plaited architectural pattern that leverages web components and specifically the
declarative shadow dom. Styles are hoisted up the dom tree into they run in a
shadow dom or the light dom and deduplicated in the process. This works in both
server side and client side rendering. It solves the problem of how do we easily
share styles across web components and provides easy ergonomics for working with
web components and regular reusable components in JSX.

## SSR

A utility function that takes createTemplate functions and return a html string
with styles. If the JSX/createTemplate tree contains a body or head tag the
styles will be moved to the end the of the later or the beginning of the former,
otherwise they will be placed before the html markup.
