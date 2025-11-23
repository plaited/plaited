import type { FunctionTemplate } from '../../../../main.ts'
import { sharedFunction } from './SharedDependency.tsx'

/**
 * Template that imports shared dependency for code splitting test.
 */
export const TemplateA: FunctionTemplate = () => <div>{sharedFunction()}</div>
