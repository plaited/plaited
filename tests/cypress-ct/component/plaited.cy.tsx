import { Button } from './button.js'

it('should display content', () => {
  const text = 'I will show up in the test'
  cy.mount(<div id='content'>{text}</div>)

  cy.get('#content').should('contain.text', text)
})

it('should render its children', () => {
  cy.mount(<Button.template>World!!!</Button.template>)

  cy.get(Button.tag).shadow().should('contain.text', 'Hello')
})
