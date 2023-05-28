import { bProgram, loop, sync, thread, Trigger } from 'plaited'


const triggers = (cb: Trigger) => ({
  createComponent() {
    cb({ type: 'createComponent' })
  },
})


const threads = {
  onNewComponent: thread(
    sync({ waitFor: { type: 'createComponent' } }),
    sync({ request: { type: 'createDefaultStory' } })
  ),
  onNewComponentProp: thread(
    sync({ waitFor: { type: 'newComponentProp' } }),
    sync({ request: { type: 'createStoryForProp' } })
  ),
}

const actions = {

}
