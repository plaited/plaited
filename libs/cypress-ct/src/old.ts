import type { Template } from '@plaited/jsx'
import { createTemplateElement } from '@plaited/component'
import { getContainerEl, setupHooks } from '@cypress/mount-utils'

let destroy: () => void | undefined

const cleanup = () => {
  if (destroy) destroy()
}

const render = (template: Template, root: HTMLElement): Promise<void> => {
  const { content, stylesheets } = template
  const style = stylesheets.size ? `<style>${[...stylesheets].join('')}</style>` : ''
  const element = createTemplateElement(style + content).content
  root.replaceChildren(element)
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      resolve()
    })
  })
}

export const mount = (template: Template) => {
  const root = getContainerEl()
  root.innerHTML = 'yeo'
  console.log('find me', { template, root })
  const renderResultPromise = render(template, root)

  Cypress.log({
    name: 'mount',
    message: 'Component',
    consoleProps: () => {
      return {
        description: 'Mounted Plaited component',
        home: 'https://github.com/plaited/plaited/tree/main/libs/cypress-ct#readme',
      }
    },
  })

  return cy.wrap(renderResultPromise, { log: false }).then((renderResult: () => void) => {
    destroy = renderResult
    return renderResult
  })
}

setupHooks(cleanup)
