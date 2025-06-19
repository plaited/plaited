import { createStoryRoute } from './create-story-route.js'
import type { StorySet, StoryParams } from '../workshop.types.js'
import type { SignalWithInitialValue } from 'plaited/behavioral'

export const addStoryParams = ({
  filePath,
  storySet,
  storyParamSetSignal,
}: {
  filePath: string
  storySet: StorySet
  storyParamSetSignal: SignalWithInitialValue<Set<StoryParams>>
}) => {
  for (const exportName in storySet) {
    const route = createStoryRoute({ filePath, exportName })
    storyParamSetSignal.get().add({
      route,
      exportName,
      filePath,
      recordVideo: storySet[exportName]?.parameters?.recordVideo,
    })
  }
}
