import type { FunctionTemplate } from 'plaited'

/**
 * Deeply nested template for testing get-entry-routes path transformation.
 * Expected bundle path: /deep/ui/forms/deep-template--index.js
 */
export const DeepTemplate: FunctionTemplate = () => <div>Deeply Nested Template</div>
