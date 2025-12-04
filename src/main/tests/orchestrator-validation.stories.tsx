import type { FT } from 'plaited'
import { story } from 'plaited/testing'

const MyTestTemplate: FT = () => (
  <div>
    <p>This is a test template inside the orchestrator fixture.</p>
  </div>
)

const TestFixture: FT = () => (
  <plaited-orchestrator>
    <plaited-header slot='header' />
    <plaited-fixture slot='fixture'>
      <MyTestTemplate />
    </plaited-fixture>
    <plaited-mask slot='mask' />
  </plaited-orchestrator>
)

export const orchestratorValidation = story({
  description: 'Validate plaited-orchestrator with header, fixture, and mask',
  template: TestFixture,
})
