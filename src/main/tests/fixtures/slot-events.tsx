import { type BProgramArgs, bElement, type FT, type Handlers } from 'plaited'

type BProgram = (args: BProgramArgs) => Handlers

export const createNestedSlotHost = (bProgram: BProgram) =>
  bElement({
    tag: 'nested-slot-host',
    shadowDom: (
      <>
        <slot p-trigger={{ click: 'nested' }}></slot>
        <slot
          p-trigger={{ click: 'nestedInShadow' }}
          name='shadow'
        ></slot>
      </>
    ),
    bProgram,
  })

export const createSlotContainer = (NestedSlotHost: ReturnType<typeof createNestedSlotHost>, bProgram: BProgram) =>
  bElement({
    tag: 'slot-container',
    shadowDom: (
      <div>
        <slot p-trigger={{ click: 'slot' }}></slot>
        <slot
          name='named'
          p-trigger={{ click: 'named' }}
        ></slot>
        <NestedSlotHost p-trigger={{ click: 'passThrough' }}>
          <slot name='nested'></slot>
          <button
            type='button'
            slot='shadow'
          >
            Shadow
          </button>
        </NestedSlotHost>
      </div>
    ),
    bProgram,
  })

export const createSlotEventsFixture = (SlotContainer: ReturnType<typeof createSlotContainer>): FT => {
  return () => (
    <SlotContainer>
      <button type='button'>Slot</button>
      <button
        type='button'
        slot='named'
      >
        Named
      </button>
      <button
        type='button'
        slot='nested'
      >
        Nested
      </button>
    </SlotContainer>
  )
}
