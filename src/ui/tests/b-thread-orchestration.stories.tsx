import { story } from 'plaited/testing'
import type { FT } from 'plaited/ui'

const TestFixture: FT = () => (
  <div>
    <p>This is a test template inside the orchestrator fixture.</p>
  </div>
)

export const bThreadOrchestration = story({
  intent: 'Validate plaited-orchestrator with header, fixture, and mask',
  template: TestFixture,
})
