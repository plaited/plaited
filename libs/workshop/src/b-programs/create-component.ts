import { bProgram } from 'plaited'

const { thread, sync } = bProgram()

const componentTypes = [ 'island', 'stateless'  ]

const threads = {
  onNewComponent: thread(
    sync({ waitFor: { type: 'createComponent' } }),
    sync({ request: { type: 'createDefaultStory' } })
  ),
  onNewComponentType: thread(
    sync({ waitFor: { type: 'newComponentProp' } }),
    sync({ request: { type: 'createStoryForProp' } })
  ),
}
