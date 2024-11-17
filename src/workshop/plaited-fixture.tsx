import { defineTemplate } from '../main/define-template.js'
import { css } from '../style/css.js'
import { PLAY_EVENT } from '../test/assert.constants.js'
import { connectTestRunner, useSendRunner, PLAITED_FIXTURE, PLAITED_RUNNER } from './plaited-fixture.utils.js'
import { usePlay } from '../test/use-play.js'

export const PlaitedFixture = defineTemplate({
  tag: PLAITED_FIXTURE,
  publicEvents: [PLAY_EVENT],
  streamAssociated: true,
  shadowDom: (
    <slot
      {...css.host({
        display: 'block',
      })}
    ></slot>
  ),
  bProgram({ bThreads, host }) {
    connectTestRunner(host)
    const send = useSendRunner(this.getAttribute('p-socket') as `/${string}`)
    const route = this.getAttribute('p-route') as string
    const storyFile = this.getAttribute('p-file') as string
    const entryPath = this.getAttribute('p-entry') as string
    const exportName = this.getAttribute('p-name') as string
    return usePlay({
      address: PLAITED_RUNNER,
      bThreads,
      send,
      route,
      storyFile,
      exportName,
      entryPath,
      host,
    })
  },
})
