import type { FunctionTemplate } from '../../../../main.js'
import { sharedFunction, sharedConstant } from './SharedDependency.js'

/**
 * Template that imports shared dependency for code splitting test.
 */
export const TemplateB: FunctionTemplate = () => (
  <div>
    {sharedFunction()} - {sharedConstant}
  </div>
)
