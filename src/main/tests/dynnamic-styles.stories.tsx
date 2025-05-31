import type { StoryObj } from 'plaited/testing'
import { defineElement, type PlaitedElement, css } from 'plaited'

const { noRepeat, repeat, initial } = css.create({
  initial: {
    border: '1px solid black',
  },
  noRepeat: {
    color: 'blue',
    textDecoration: 'underline',
  },
  repeat: {
    color: 'purple',
    textDecoration: 'underline',
  },
})

export const dynamicStyles: StoryObj = {
  description: `This story is used to validate that when rendering/inserting new JSX with styles
  into the plaited element shadow dom those styles sheets are applied to the constructed styles
  and do not repeat`,
  play: async ({ findByText, assert, findByAttribute, wait, hostElement }) => {
    hostElement.setHTMLUnsafe(
      (
        <dynamic-only data-testid='element'>
          <template
            shadowrootmode='open'
            shadowrootdelegatesfocus
          >
            <div
              p-target='target'
              {...initial}
            ></div>
          </template>
        </dynamic-only>
      ).html.join(''),
    )
    const style = await findByText(initial.stylesheet.join(''))
    assert({
      given: 'Render with initial stylesheet, Style tag',
      should: 'have the initial stylesheet only',
      actual: style?.textContent,
      expected: initial.stylesheet.join(''),
    })
    defineElement({
      publicEvents: ['render'],
      tag: 'dynamic-only',
      shadowDom: (
        <div
          p-target='target'
          {...initial}
        ></div>
      ),
      bProgram({ $ }) {
        return {
          render() {
            const [target] = $<HTMLDivElement>('target')
            target.insert('beforeend', <div {...noRepeat}>construable stylesheet applied once</div>)
            target.insert('beforeend', <div {...repeat}>not applied</div>)
          },
        }
      },
    })
    let target = await findByAttribute<PlaitedElement>('data-testid', 'element')
    assert({
      given: 'target has not been triggered',
      should: 'have adoptedStyleSheets of length 1',
      actual: target?.shadowRoot?.adoptedStyleSheets.length,
      expected: 1,
    })
    target?.trigger({ type: 'render' })
    await wait(60)
    target = await findByAttribute<PlaitedElement>('data-testid', 'element')
    assert({
      given: 'target has been triggered',
      should: 'have adoptedStyleSheets of length 3',
      actual: target?.shadowRoot?.adoptedStyleSheets.length,
      expected: 4,
    })
  },
}
