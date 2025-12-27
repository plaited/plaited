# Terminology: Templates Not Components

**IMPORTANT**: Plaited is a **template-based** framework, not a component-based framework.

## Use This Terminology

- ✅ Use: template, templates, FunctionTemplate, BehavioralTemplate
- ❌ Avoid: component, components

## Browser Platform APIs

When referring to browser platform APIs, use their specific names directly:

- **Custom Elements API**: `customElements.define()` for registering custom HTML elements
- **Shadow DOM API**: Encapsulated DOM and styling
- **HTML Templates**: `<template>` element including [Declarative Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/template#declarative_shadow_dom)
- **Related APIs**: [`Element.setHTMLUnsafe`](https://developer.mozilla.org/en-US/docs/Web/API/Element/setHTMLUnsafe) and other web platform APIs

❌ Avoid the umbrella term "Web Components" - refer to specific APIs instead (Custom Elements, Shadow DOM, etc.)

## In Documentation and Code

- Plaited templates (created with `bElement` or as functions)
- Template exports, template metadata, template discovery
- Template tests (not component tests)
- Template lifecycle (not component lifecycle)
