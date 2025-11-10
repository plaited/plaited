import type { FunctionTemplate } from '../../../../main.js'

export const SimpleTemplate: FunctionTemplate = () => <div>Simple</div>

export const TemplateWithProps: FunctionTemplate = (props) => <div>{props?.text || 'default'}</div>

export function FunctionDeclarationTemplate() {
  return <span>Function Declaration</span>
}

export const ArrowTemplate: FunctionTemplate = () => (
  <section>
    <h1>Arrow Template</h1>
    <p>Using JSX</p>
  </section>
)
