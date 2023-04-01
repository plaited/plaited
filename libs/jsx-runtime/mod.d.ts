import { Props } from '../islandly/create-template.ts'

declare namespace JSX {
  type IntrinsicAttributes = Props
  interface IntrinsicElements {
    [elemName: string]: IntrinsicAttributes
  }
}
