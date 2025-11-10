import type { FunctionTemplate } from '../../../../main.js'
import { sharedFunction } from './SharedDependency.js'

/**
 * Template that imports shared dependency for code splitting test.
 */
export const TemplateA: FunctionTemplate = () => <div>{sharedFunction()}</div>
