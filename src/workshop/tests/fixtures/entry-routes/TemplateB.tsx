import type { FunctionTemplate } from 'plaited'
import { sharedConstant, sharedFunction } from './SharedDependency.tsx'

/**
 * Template that imports shared dependency for code splitting test.
 */
export const TemplateB: FunctionTemplate = () => (
  <div>
    {sharedFunction()} - {sharedConstant}
  </div>
)
