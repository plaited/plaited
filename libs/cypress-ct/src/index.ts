/// <reference types="cypress" />

import { getContainerEl, setupHooks } from '@cypress/mount-utils'
import type { Template } from '@plaited/jsx'
import { createTemplateElement } from '@plaited/component'

let destroy: () => void | undefined

const cleanup = () => {
  if (destroy) destroy()
}

interface MountingOptions {
  log?: boolean
}

const render = (template: Template, root: HTMLElement): Promise<() => void> => {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      const { content, stylesheets } = template
      const style = stylesheets.size ? `<style>${[...stylesheets].join('')}</style>` : ''
      const element = createTemplateElement(style + content).content
      root.replaceChildren(element)
      resolve(() => root.replaceChildren())
    })
  })
}

/**
 * Mounts a Plaited `<FunctionTemplate />` template result into a component test.
 *
 * @param component The Plaited template
 * @param options An options hash, allowing you to disable logging
 * @returns The children mounted into the component test root.
 *
 * @example cy.mount(<MyComponent />)
 */
export function mount(component: Template, { log = true }: MountingOptions = {}) {
  cleanup()

  const container = getContainerEl()
  const renderResultPromise = render(component, container)

  return cy.wrap(renderResultPromise, { log: false }).then(async (renderResult: () => void) => {
    destroy = renderResult
    log &&
      Cypress.log({
        name: 'mount',
        message: 'Mounted Plaited Element',
      })
  })
}

setupHooks(cleanup)
