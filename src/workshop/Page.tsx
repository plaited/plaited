import { FunctionTemplate } from '../jsx/jsx.types.js'
import { UsePlay } from './use-play.js'

export const Page: FunctionTemplate<{ storyId: string }> = ({ children, storyId }) => {
  return (
    <html>
      <head>
        <title>Storybook: {storyId}</title>
      </head>
      <body>
        <UsePlay id={storyId}>{children}</UsePlay>
      </body>
    </html>
  )
}
