import type { FT } from 'plaited'
import { story } from 'plaited/testing'

const TestFixture: FT = () => (
  <div>
    <p>This is a test template inside the orchestrator fixture.</p>
  </div>
)

export const orchestratorValidation = story({
  description: 'Validate plaited-orchestrator with header, fixture, and mask',
  template: TestFixture,
})
