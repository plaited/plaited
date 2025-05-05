import { css } from '../styling/css'
import { defineElement } from '../main/define-element'
import { usePlay } from './use-play'
import { PLAY_EVENT, PLAITED_FIXTURE, PLAITED_RUNNER } from './assert.constants'
import { connectTestRunner, useSendRunner } from './plaited-fixture.utils'
import { h } from '../jsx/create-template.js'

/**
 * @element plaited-test-fixture
 * @description A custom element designed to host and execute a single Plaited story test.
 * It receives test parameters via attributes, connects to the test runner via WebSocket
 * loads the specified story module, executes its `play` function (if defined),
 * and reports results or errors back to the runner.
 *
 * @attr {string} p-socket - The WebSocket URL path for communicating with the test runner server.
 * @attr {string} p-route - The unique route identifier for the story being tested.
 * @attr {string} p-file - The original source file path of the story.
 * @attr {string} p-entry - The path to the compiled JavaScript module containing the story export.
 * @attr {string} p-name - The name of the exported story object within the module.
 *
 * @fires play - Dispatched internally to initiate the story's play function execution.
 *
 * @example
 * ```html
 * <plaited-test-fixture
 *   p-socket="/_plaited"
 *   p-route="button--primary"
 *   p-file="src/components/button.stories.ts"
 *   p-entry="/dist/button.stories.js"
 *   p-name="Primary"
 * >
 *   <!-- The rendered story component will be placed here by the test runner -->
 * </plaited-test-fixture>
 * ```
 */
export const PlaitedFixture = defineElement({
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
