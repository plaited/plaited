import type { FunctionTemplate } from '../../../../main.js'

// This file matches the exclude pattern **/*.tpl.spec.{ts,tsx}
// It should NOT appear in discovery results

export const ExcludedTemplate: FunctionTemplate = () => <div>Should be excluded</div>

export const AnotherExcluded: FunctionTemplate = () => <span>Also excluded</span>
