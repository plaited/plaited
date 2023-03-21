import { isle } from '../../../../islandly/mod.ts'

isle(
  { tag: 'test-fixture' },
  class extends HTMLElement {
    plait() {}
  },
)
