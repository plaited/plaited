# Terminology: Templates Not Components

**IMPORTANT**: Plaited is a **template-based** framework, not a component-based framework.

## Use This Terminology

- ✅ Use: template, templates, FunctionTemplate, BehavioralTemplate
- ❌ Avoid: component, components (except when referring to Web Components API)

## Exception: Web Components API

The term "Web Components" refers to the browser's [Web Components API set](https://developer.mozilla.org/en-US/docs/Web/API/Web_components) and should remain unchanged. This includes:

- **Custom Elements**: `customElements.define()` for registering custom HTML elements
- **Shadow DOM**: Encapsulated DOM and styling
- **HTML Templates**: `<template>` element including [Declarative Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/template#declarative_shadow_dom)
- **Related APIs**: [`Element.setHTMLUnsafe`](https://developer.mozilla.org/en-US/docs/Web/API/Element/setHTMLUnsafe) and other web platform APIs

This is the standard browser platform terminology, not framework-specific.

## In Documentation and Code

- Plaited templates (created with `bElement` or as functions)
- Template exports, template metadata, template discovery
- Template tests (not component tests)
- Template lifecycle (not component lifecycle)
