import { story } from 'plaited/testing'
import type { FT } from 'plaited/ui'
import { cardStyles } from './card.css.ts'

/**
 * Basic card container.
 */
const Card: FT = ({ children }) => <div {...cardStyles.card}>{children}</div>

/**
 * Card header section.
 */
const CardHeader: FT = ({ children }) => <div {...cardStyles.header}>{children}</div>

/**
 * Card body section.
 */
const CardBody: FT = ({ children }) => <div {...cardStyles.body}>{children}</div>

/**
 * Card footer section.
 */
const CardFooter: FT = ({ children }) => <div {...cardStyles.footer}>{children}</div>

/**
 * Card title text.
 */
const CardTitle: FT = ({ children }) => <h3 {...cardStyles.title}>{children}</h3>

/**
 * Card body text.
 */
const CardText: FT = ({ children }) => <p {...cardStyles.text}>{children}</p>

export const meta = {
  title: 'Training/Card',
}

export const basicCard = story({
  intent: 'Create a card with header and body sections',
  template: () => (
    <Card>
      <CardHeader>Card Header</CardHeader>
      <CardBody>
        <CardTitle>Card Title</CardTitle>
        <CardText>
          This is some example text content inside the card body. Cards are great for organizing related content.
        </CardText>
      </CardBody>
    </Card>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})

export const cardWithFooter = story({
  intent: 'Create a card with header, body, and footer sections',
  template: () => (
    <Card>
      <CardHeader>Featured</CardHeader>
      <CardBody>
        <CardTitle>Special Content</CardTitle>
        <CardText>This card has a footer section for additional actions or information.</CardText>
      </CardBody>
      <CardFooter>Last updated 3 mins ago</CardFooter>
    </Card>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})

export const simpleCard = story({
  intent: 'Create a simple card with body content only',
  template: () => (
    <Card>
      <CardBody>
        <CardTitle>Simple Card</CardTitle>
        <CardText>A minimal card without header or footer, just the essentials.</CardText>
      </CardBody>
    </Card>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
