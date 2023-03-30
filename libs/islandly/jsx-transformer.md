I'd like you to help me write a custom jsx transformer in typescript. Here are
the requirements.

- my transformer function is name **createTemplate**
- createTemplate creates template element and returns that template elements
  cloned content deeply see example :
  `const fragment = template.content.cloneNode(true)`
- createTemplate creates a cache of the the template content **fragment** it is
  stored in WeakMap called cache that is global
- like other js transformers my function createTemplate takes 3 arguments
  - tagName/component
  - props
  - and children
- The first argument is string that can be and html or svg tag or a component.
  If the tag is a custom element tag one which has `$string}-${string}`
  signature with optional following dashes and string then the following rules
  must be adhered too.
  - The immediate first child of our tag will be a template node like
    `<template shadowrootmode={shadowrootmode} and shadowrootdelegatesfocus={shadowrootdelegatesfocus}></template>`
    shadowrootmode value must be `open` or string `closed` it should default if
    not provided to `open` shadowrootdelegatesfocus is also optional and is a
    boolean type. It should default to true.
  - All children passed to createTemplate who's first argument is a custom
    element tag are to be children of the formentioned template tag wchich will
    be the first child.
  - If child element is passed to such a createTemplate component that has the
    attribute slot='{string}' it is to be appended as a sibling to template tag
    ans the createTemplate's next direct childNode
- The second argument props has the following rules /code
  - no props that begin with `on` are allowed. All values must be of the
    type:`type Primitive =type Primitive = void | null | undefined | number | string | boolean | bigint`
    or
    `interface UseValueGetter<T extends Primitive> { (): T; interface UseValueGetter<T extends Primitive> {  (): T | publisher: Messenger<T>}`
  - boolean`if the first argument the tag name has a custom element tag meaning
    one that ${string}-${string} with optional following dashes and string then
    the createTemplate will create a template element whose firstChild is the
    custom element tag. The custom element tag will automatically have a tag of
    Note that if the tag is a custom element then rootMode is a require prop on
    the second argument props. It's only valid values are open and close.
    Further shadowrootdelegatesfocus is optional and only appears if
    shadowDelegateFocus: true is in the props object. both shadowRootMode can
    only be used on custom elements and.
  - If the prop slot is present it is to be assigned to the function like so
    this.slot = {string} so that when parsing the component we can check if this
    prop is present and move the component to be sibling of a custom element
    type component.
  - If the value passed to the property is an instance of UseValueGetter then we
    want to invoke the function and pass a callback to func.publisher((val) =>
    el.setAttribute('{prop key}', value) )
  - All data attributes are to be written in camel case and then transformed
    into dash case.
  - className is to be used for css classes
  - htmlFor is to be used for the for attribute
  - the styles is only allowed if the first argument is a custom element. The
    attribute can must accept a string or a Set<string> it is the only prop. If
    this prop is present then we prepend the contents of this string or set
    joined a single string to the template node of our new custom element inside
    a style tag.
- our third argument is children nodes. These can be string or other components
  created with create template we will append the content to our template or
  custom elements template. If our first argument is custom element tag and one
  fo these children has the prop slot on it then we append it as a sibling to
  our custom elements template.

We want to cache the return of our createTemplate return in a weakmap that is
global to the function createTemplate.
