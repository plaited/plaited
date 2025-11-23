import type { FunctionTemplate } from '../../../../main.ts'
import { sharedConstant, sharedFunction } from './SharedDependency.tsx'

/**
 * Template that imports shared dependency for code splitting test.
 */
export const TemplateB: FunctionTemplate = () => (
  <div>
    {sharedFunction()} - {sharedConstant}
  </div>
)
