import { bElement, type FunctionTemplate } from 'plaited'

// File with no StoryObj exports

export const SimpleComponent: FunctionTemplate = () => <div>Simple</div>

export const ComplexComponent = bElement({
  tag: 'complex-component',
  shadowDom: <section>Complex</section>,
  bProgram({ trigger }) {
    return {
      handleClick() {
        trigger({ type: 'clicked' })
      },
    }
  },
})

export const config = {
  title: 'Configuration',
  version: '1.0.0',
  settings: {
    enabled: true,
    limit: 100,
  },
}

export function helperFunction(value: string): string {
  return value.toUpperCase()
}

export class UtilityClass {
  private value: number

  constructor(value: number) {
    this.value = value
  }

  getValue(): number {
    return this.value
  }
}

export interface ConfigInterface {
  name: string
  options: Record<string, unknown>
}
