import type { FunctionTemplate } from '../ui.ts'
import { PlaitedFixture } from './plaited-fixture.tsx'
import { STORY_IDENTIFIER, STORY_TYPES } from './testing.constants.ts'
import type {
  InteractionExport,
  InteractionStoryObj,
  SnapshotExport,
  SnapshotStoryObj,
  StoryExport,
  StoryObj,
} from './testing.types.ts'

const createStoryExport = <T extends FunctionTemplate>(
  { args, template, ...rest }: StoryObj<T>,
  flags: { only?: boolean; skip?: boolean } = {},
): StoryExport<T> => {
  const tpl = template?.(args || {})
  const fixture = <PlaitedFixture>{tpl}</PlaitedFixture>
  if (rest.play) {
    return {
      ...rest,
      template,
      args,
      type: STORY_TYPES.interaction,
      fixture,
      play: rest.play,
      $: STORY_IDENTIFIER,
      ...flags,
    } as InteractionExport<T>
  }
  return {
    template,
    args,
    description: rest.description,
    parameters: rest.parameters,
    type: STORY_TYPES.snapshot,
    fixture,
    $: STORY_IDENTIFIER,
    ...flags,
  } as SnapshotExport<T>
}

function storyBase<T extends FunctionTemplate>(args: InteractionStoryObj<T>): InteractionExport<T>
function storyBase<T extends FunctionTemplate>(args: SnapshotStoryObj<T>): SnapshotExport<T>
function storyBase<T extends FunctionTemplate>(args: StoryObj<T>): StoryExport<T> {
  return createStoryExport(args)
}

function storyOnly<T extends FunctionTemplate>(args: InteractionStoryObj<T>): InteractionExport<T>
function storyOnly<T extends FunctionTemplate>(args: SnapshotStoryObj<T>): SnapshotExport<T>
function storyOnly<T extends FunctionTemplate>(args: StoryObj<T>): StoryExport<T> {
  return createStoryExport(args, { only: true })
}

function storySkip<T extends FunctionTemplate>(args: InteractionStoryObj<T>): InteractionExport<T>
function storySkip<T extends FunctionTemplate>(args: SnapshotStoryObj<T>): SnapshotExport<T>
function storySkip<T extends FunctionTemplate>(args: StoryObj<T>): StoryExport<T> {
  return createStoryExport(args, { skip: true })
}

const story = Object.assign(storyBase, {
  only: storyOnly,
  skip: storySkip,
})

export { story }
