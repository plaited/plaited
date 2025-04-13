import { css } from '../styling/css'
import { defineTemplate } from '../main/define-template'
import { usePlay } from './use-play'
import { PLAY_EVENT, PLAITED_FIXTURE, PLAITED_RUNNER } from './assert.constants'
import { connectTestRunner, useSendRunner } from './plaited-fixture.utils'
import { h } from '../jsx/create-template.js'

export const PlaitedFixture = defineTemplate({
  tag: PLAITED_FIXTURE,
  publicEvents: [PLAY_EVENT],
  streamAssociated: true,
  shadowDom: h('slot', {
    ...css.host({
      display: 'block',
    }),
  }),
  bProgram({ bThreads, host, trigger }) {
    connectTestRunner(host, trigger)
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
